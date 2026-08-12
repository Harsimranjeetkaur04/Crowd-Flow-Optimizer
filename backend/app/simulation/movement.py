"""Density-aware walking speed and outflow movement models."""

from __future__ import annotations


def calculate_density(people: float, capacity: float) -> float:
    """Compute crowd density ratio (0.0 to 1.0+)."""
    if capacity <= 0:
        return 1.0
    return max(0.0, people / capacity)


def get_speed_multiplier(density: float) -> float:
    """Return movement speed multiplier based on crowd density thresholds.

    Density       Movement Speed Multiplier
    <50%          1.00 (100% speed)
    50-70%        0.80 (80% speed)
    70-85%        0.50 (50% speed)
    >85%          0.20 (20% speed)
    """
    if density < 0.50:
        return 1.00
    elif density < 0.70:
        return 0.80
    elif density < 0.85:
        return 0.50
    else:
        return 0.20


def get_effective_walking_speed(base_speed: float, density: float) -> float:
    """Calculate actual walking speed in m/s adjusted for density."""
    return base_speed * get_speed_multiplier(density)


def calculate_effective_outflow(max_flow_rate: float, density: float) -> float:
    """Calculate effective outflow capacity of a corridor/node per timestep."""
    multiplier = get_speed_multiplier(density)
    return max_flow_rate * multiplier
