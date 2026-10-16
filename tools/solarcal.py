"""Simplified SolarCal: the rise in mean radiant temperature from sun on a person.

Based on ASHRAE 55 Appendix C (Arens et al. 2015). Pure Python, no numpy, so the
same file can be pasted into a Grasshopper Python component.

Every constant below is an ASSUMPTION (see ASSUMPTIONS.md, A10-A13).
Output is an ESTIMATE, not a simulation.
"""
import math

ALPHA_SW = 0.67   # A10  shortwave absorptivity of skin/clothing (ASHRAE 55 default)
ALPHA_LW = 0.95   # longwave absorptivity
F_EFF = 0.696     # A11  effective radiating area fraction, seated person
H_R = 6.012       # radiative heat transfer coefficient, W/m2K
F_P = 0.25        # A12  projected area factor, seated (really varies with sun angle)
R_FLOOR = 0.25    # A13  floor reflectance


def delta_mrt(i_dir_normal, i_diff_horiz, sun_alt_deg, sun_visible, sky_view, tau):
    """Rise in MRT (K) at one point for one hour.

    i_dir_normal   direct normal irradiance outside, W/m2
    i_diff_horiz   diffuse horizontal irradiance outside, W/m2
    sun_alt_deg    solar altitude, degrees
    sun_visible    1 if the point sees the sun through glazing this hour, else 0
    sky_view       fraction of the sky the person sees (0-1)
    tau            solar transmittance of the glazing in the way (0-1)
    """
    if sun_alt_deg <= 0:
        return 0.0
    i_th = i_dir_normal * math.sin(math.radians(sun_alt_deg)) + i_diff_horiz
    diffuse_part = 0.5 * F_EFF * sky_view * (i_diff_horiz + i_th * R_FLOOR)
    direct_part = F_EFF * F_P * sun_visible * i_dir_normal
    erf = (diffuse_part + direct_part) * tau * ALPHA_SW / ALPHA_LW
    return erf / (F_EFF * H_R)


def solar_position(lat_deg, day_of_year, solar_hour):
    """Approximate solar altitude and azimuth (degrees, azimuth clockwise from north)."""
    decl = 23.45 * math.sin(math.radians(360.0 * (284 + day_of_year) / 365.0))
    ha = 15.0 * (solar_hour - 12.0)
    lat, d, h = (math.radians(v) for v in (lat_deg, decl, ha))
    sin_alt = math.sin(lat) * math.sin(d) + math.cos(lat) * math.cos(d) * math.cos(h)
    alt = math.asin(max(-1.0, min(1.0, sin_alt)))
    cos_az = (math.sin(d) - math.sin(alt) * math.sin(lat)) / (math.cos(alt) * math.cos(lat) + 1e-9)
    az = math.degrees(math.acos(max(-1.0, min(1.0, cos_az))))
    if ha > 0:
        az = 360.0 - az
    return math.degrees(alt), az
