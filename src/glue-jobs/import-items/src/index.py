import logging
import sys
from collections.abc import Iterable
from urllib.parse import unquote

from awsglue.context import GlueContext
from awsglue.dynamicframe import DynamicFrame
from awsglue.job import Job
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from pyspark.sql import DataFrame
from pyspark.sql.functions import col, length, trim

REQUIRED_COLUMNS = ("id", "name", "description")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)


def build_source_uri(bucket: str, key: str) -> str:
    if not bucket or not key:
        raise ValueError("SOURCE_BUCKET and SOURCE_KEY must be non-empty")
    if any(character in bucket or character in key for character in ("\n", "\r", "\x00")):
        raise ValueError("SOURCE_BUCKET and SOURCE_KEY must not contain control characters")
    return f"s3://{bucket}/{unquote(key)}"


def validate_columns(columns: Iterable[str]) -> None:
    available_columns = set(columns)
    missing_columns = [column for column in REQUIRED_COLUMNS if column not in available_columns]
    if missing_columns:
        raise ValueError(f"Parquet file is missing required columns: {', '.join(missing_columns)}")


def transform_data(data_frame: DataFrame) -> DataFrame:
    validate_columns(data_frame.columns)
    selected = data_frame.select(
        *(col(column).cast("string").alias(column) for column in REQUIRED_COLUMNS)
    )
    return (
        selected.dropna(subset=list(REQUIRED_COLUMNS))
        .filter(length(trim(col("id"))) > 0)
        .dropDuplicates(["id"])
    )


def initialize_contexts(arguments: dict[str, str]) -> tuple[GlueContext, Job]:
    spark_context = SparkContext.getOrCreate()
    spark_context.setLogLevel("WARN")
    glue_context = GlueContext(spark_context)
    job = Job(glue_context)
    job.init(arguments["JOB_NAME"], arguments)
    return glue_context, job


def run_import(arguments: dict[str, str], glue_context: GlueContext) -> None:
    source_uri = build_source_uri(arguments["SOURCE_BUCKET"], arguments["SOURCE_KEY"])
    logger.info("Reading Parquet input")
    data_frame = glue_context.spark_session.read.parquet(source_uri)
    items = transform_data(data_frame)
    dynamic_frame = DynamicFrame.fromDF(items, glue_context, "items")

    glue_context.write_dynamic_frame.from_options(
        frame=dynamic_frame,
        connection_type="dynamodb",
        connection_options={"dynamodb.output.tableName": arguments["DYNAMODB_TABLE"]},
        transformation_ctx="dynamodb_items",
    )
    logger.info("DynamoDB import completed")


def main() -> None:
    arguments = getResolvedOptions(
        sys.argv,
        ["JOB_NAME", "SOURCE_BUCKET", "SOURCE_KEY", "DYNAMODB_TABLE"],
    )
    glue_context, job = initialize_contexts(arguments)
    run_import(arguments, glue_context)
    job.commit()


if __name__ == "__main__":
    main()
