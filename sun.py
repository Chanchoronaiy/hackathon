"""
Sun position + shade-score estimation.

Real shadow-casting needs 3D building geometry, which is out of scope for
a weekend build. Instead we approximate shade using each street's compass
bearing relative to the sun's azimuth: streets running roughly *parallel*
to the sun's direction tend to sit in the shadow of buildings alongside
them, while streets running *perpendicular* to the sun catch more direct
light down their length.

This is a heuristic, not physically exact shadow-casting - but it's
explainable, fast, and gives genuinely different-looking routes depending
on time of day, which is what matters for a demo.
"""

from datetime import datetime
import math
from astral import LocationInfo
from astral.sun import azimuth, elevation


def get_sun_position(lat: float, lon: float, when: datetime) -> tuple[float, float]:
    """
    Returns (azimuth_deg, elevation_deg) of the sun for a given location/time.

    azimuth: compass direction of the sun (0=North, 90=East, 180=South, 270=West)
    elevation: how high the sun is above the horizon (negative = below horizon)
    """
    if when.tzinfo is None:
        raise ValueError(
            "get_sun_position() needs a timezone-aware datetime - a naive one "
            "is silently treated as UTC and will give the wrong sun position. "
            "Use e.g. datetime(..., tzinfo=ZoneInfo('Australia/Adelaide'))."
        )

    location = LocationInfo(latitude=lat, longitude=lon)
    az = azimuth(location.observer, when)
    el = elevation(location.observer, when)
    return az, el


def shade_score(street_bearing_deg: float, sun_azimuth_deg: float, sun_elevation_deg: float) -> float:
    """
    Estimate how "shaded" a street segment is, as a score from 0 (full sun)
    to 1 (fully shaded).

    Logic:
    - If the sun is below the horizon (night / elevation <= 0), everywhere
      is "shaded" -> score 1.0 (sun avoidance is irrelevant at night, but
      we don't want the router to divide by zero or misbehave).
    - Otherwise, compare the street's bearing to the sun's azimuth. The
      closer they are to parallel (0 deg or 180 deg apart), the more shade
      we assume nearby buildings cast across the street.
    - A low sun (near the horizon) casts longer shadows, so we scale the
      shade effect up as elevation drops toward 0, and down as the sun
      gets high overhead (less shadow regardless of street orientation).
    """
    if sun_elevation_deg <= 0:
        return 1.0

    # angle between street bearing and sun azimuth, folded into 0-90 range
    diff = abs(street_bearing_deg - sun_azimuth_deg) % 180
    if diff > 90:
        diff = 180 - diff

    # diff=0 (parallel to sun) -> more shade; diff=90 (perpendicular) -> more sun
    parallelism = 1 - (diff / 90)  # 1.0 when parallel, 0.0 when perpendicular

    # low sun (near horizon) casts longer shadows -> amplify effect
    # high sun (near 90 deg overhead) casts short shadows -> dampen effect
    elevation_factor = max(0.0, 1 - (sun_elevation_deg / 90))

    return parallelism * elevation_factor
