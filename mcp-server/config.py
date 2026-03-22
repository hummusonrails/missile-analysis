"""Constants for SirenWise MCP server."""

DEFAULT_CITY = "מודיעין-מכבים-רעות"

NIGHT_START = 22  # 10 PM
NIGHT_END = 6     # 6 AM
DEEP_SLEEP_START = 0   # midnight
DEEP_SLEEP_END = 5     # 5 AM

DEFAULT_CLUSTER_WINDOW_MINUTES = 5

TIMEZONE = "Asia/Jerusalem"

THREAT_LABELS = {
    0: "Rockets/Missiles",
    1: "Unknown",
    2: "Infiltration/Terror",
    3: "Earthquake",
    4: "Tsunami",
    5: "Hostile Aircraft",
    6: "Hazardous Materials",
    7: "Unconventional Weapon",
    8: "Nuclear Threat",
    13: "Hostile Fire",
}
THREAT_LABEL_DEFAULT = "Unknown Threat"
