"""Which countries and bidding zones to download, and from when."""

START_DATE = "2021-01-01"  # history depth for the first (backfill) run
LOCAL_TZ = "Europe/Brussels"  # daily and monthly aggregation uses CET/CEST days

# EU27 countries, by ENTSO-E area code (entsoe-py names)
# Used for generation mix and load.
COUNTRIES = {
    "AT": "Austria", "BE": "Belgium", "BG": "Bulgaria", "HR": "Croatia",
    "CY": "Cyprus", "CZ": "Czechia", "DK": "Denmark", "EE": "Estonia",
    "FI": "Finland", "FR": "France", "DE": "Germany", "GR": "Greece",
    "HU": "Hungary", "IE": "Ireland", "IT": "Italy", "LV": "Latvia",
    "LT": "Lithuania", "LU": "Luxembourg", "MT": "Malta", "NL": "Netherlands",
    "PL": "Poland", "PT": "Portugal", "RO": "Romania", "SK": "Slovakia",
    "SI": "Slovenia", "ES": "Spain", "SE": "Sweden",
}

# Day-ahead price zones covering EU27.
# Countries split into several zones (DK, IT, SE) are listed zone by zone.
# DE and LU share one zone. IE is priced in the all-island SEM.
# Cyprus and Malta have no day-ahead market coupled to SDAC: expect no data.
PRICE_ZONES = {
    "AT": "AT", "BE": "BE", "BG": "BG", "HR": "HR", "CZ": "CZ",
    "DK_1": "DK", "DK_2": "DK", "EE": "EE", "FI": "FI", "FR": "FR",
    "DE_LU": "DE", "GR": "GR", "HU": "HU", "IE_SEM": "IE",
    "IT_NORD": "IT", "IT_CNOR": "IT", "IT_CSUD": "IT", "IT_SUD": "IT",
    "IT_CALA": "IT", "IT_SICI": "IT", "IT_SARD": "IT",
    "LV": "LV", "LT": "LT", "NL": "NL", "PL": "PL", "PT": "PT",
    "RO": "RO", "SK": "SK", "SI": "SI", "ES": "ES",
    "SE_1": "SE", "SE_2": "SE", "SE_3": "SE", "SE_4": "SE",
}
