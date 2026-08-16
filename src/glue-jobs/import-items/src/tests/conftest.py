import sys
from unittest.mock import MagicMock

for module_name in (
    "awsglue",
    "awsglue.context",
    "awsglue.dynamicframe",
    "awsglue.job",
    "awsglue.utils",
    "pyspark",
    "pyspark.context",
    "pyspark.sql",
    "pyspark.sql.functions",
):
    sys.modules[module_name] = MagicMock()
