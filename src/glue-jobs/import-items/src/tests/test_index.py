from unittest.mock import MagicMock, call, patch

import pytest

import index


@pytest.fixture
def arguments() -> dict[str, str]:
    return {
        "JOB_NAME": "import-items",
        "SOURCE_BUCKET": "input-bucket",
        "SOURCE_KEY": "incoming/items%202026.parquet",
        "DYNAMODB_TABLE": "items",
    }


def test_build_source_uri_decodes_the_eventbridge_key() -> None:
    assert (
        index.build_source_uri("input-bucket", "incoming/items%202026.parquet")
        == "s3://input-bucket/incoming/items 2026.parquet"
    )


@pytest.mark.parametrize(
    ("bucket", "key"),
    [("", "items.parquet"), ("input-bucket", ""), ("input-bucket", "bad\nkey")],
)
def test_build_source_uri_rejects_invalid_event_values(bucket: str, key: str) -> None:
    with pytest.raises(ValueError):
        index.build_source_uri(bucket, key)


def test_validate_columns_rejects_an_incomplete_schema() -> None:
    with pytest.raises(ValueError, match="description"):
        index.validate_columns(["id", "name"])


def test_transform_data_selects_and_cleans_the_three_fields() -> None:
    data_frame = MagicMock(columns=["description", "ignored", "id", "name"])
    selected = data_frame.select.return_value
    without_nulls = selected.dropna.return_value
    filtered = without_nulls.filter.return_value
    transformed = filtered.dropDuplicates.return_value

    with (
        patch.object(index, "col") as column,
        patch.object(index, "length") as length,
        patch.object(index, "trim") as trim,
    ):
        predicate = MagicMock()
        length.return_value.__gt__.return_value = predicate
        result = index.transform_data(data_frame)

    assert result is transformed
    assert column.call_args_list == [call("id"), call("name"), call("description"), call("id")]
    selected.dropna.assert_called_once_with(subset=["id", "name", "description"])
    trim.assert_called_once_with(column.return_value)
    length.assert_called_once_with(trim.return_value)
    without_nulls.filter.assert_called_once_with(predicate)
    filtered.dropDuplicates.assert_called_once_with(["id"])


def test_initialize_contexts_starts_the_glue_job(arguments: dict[str, str]) -> None:
    spark_context = index.SparkContext.getOrCreate.return_value
    glue_context = index.GlueContext.return_value
    job = index.Job.return_value

    assert index.initialize_contexts(arguments) == (glue_context, job)

    spark_context.setLogLevel.assert_called_once_with("WARN")
    index.GlueContext.assert_called_once_with(spark_context)
    job.init.assert_called_once_with("import-items", arguments)


def test_run_import_reads_one_file_and_writes_dynamodb(arguments: dict[str, str]) -> None:
    glue_context = MagicMock()
    data_frame = glue_context.spark_session.read.parquet.return_value
    items = MagicMock()
    dynamic_frame = MagicMock()

    with patch.object(index, "transform_data", return_value=items) as transform_data:
        index.DynamicFrame.fromDF.return_value = dynamic_frame
        index.run_import(arguments, glue_context)

    glue_context.spark_session.read.parquet.assert_called_once_with(
        "s3://input-bucket/incoming/items 2026.parquet"
    )
    transform_data.assert_called_once_with(data_frame)
    index.DynamicFrame.fromDF.assert_called_once_with(items, glue_context, "items")
    glue_context.write_dynamic_frame.from_options.assert_called_once_with(
        frame=dynamic_frame,
        connection_type="dynamodb",
        connection_options={"dynamodb.output.tableName": "items"},
        transformation_ctx="dynamodb_items",
    )


def test_main_commits_only_after_a_successful_import(arguments: dict[str, str]) -> None:
    glue_context = MagicMock()
    job = MagicMock()

    with (
        patch.object(index, "getResolvedOptions", return_value=arguments) as resolve_options,
        patch.object(index, "initialize_contexts", return_value=(glue_context, job)),
        patch.object(index, "run_import") as run_import,
    ):
        index.main()

    resolve_options.assert_called_once_with(
        index.sys.argv,
        ["JOB_NAME", "SOURCE_BUCKET", "SOURCE_KEY", "DYNAMODB_TABLE"],
    )
    run_import.assert_called_once_with(arguments, glue_context)
    job.commit.assert_called_once_with()
