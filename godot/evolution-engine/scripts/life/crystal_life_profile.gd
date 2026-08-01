extends RefCounted

## Pure presentation profile for Crystal life cues. Sampling never mutates DNA,
## Growth Instructions or canonical history. Time is runtime-only and therefore
## intentionally excluded from deterministic snapshots.

const DeterministicRNG = preload("res://scripts/core/deterministic_rng.gd")

const VERSION := "crystal-life-profile-v1"
const IDLE_PERIOD_SECONDS := 8.4
const REVEAL_DURATION_SECONDS := 1.05
const IMPACT_DURATION_SECONDS := 1.4
const MIN_AXIAL_REVEAL_SCALE := 0.12
const MIN_RADIAL_REVEAL_SCALE := 0.72
const MIN_EMISSION_FACTOR := 0.94
const MAX_EMISSION_FACTOR := 1.18
const MIN_RIM_FACTOR := 0.97
const MAX_RIM_FACTOR := 1.09
const MAX_IMPACT_FLASH := 0.48


func sample(
	dna_seed: int,
	instruction,
	elapsed_seconds: float,
	reveal_elapsed: float = -1.0,
	impact_elapsed: float = -1.0,
	reduced_motion: bool = false,
) -> Dictionary:
	if reduced_motion:
		return {
			"version": VERSION,
			"phase": 0.0,
			"idle_wave": 0.5,
			"emission_factor": 1.0,
			"rim_factor": 1.0,
			"impact_flash": 0.0,
			"reveal_progress": 1.0,
			"axial_scale": 1.0,
			"radial_scale": 1.0,
			"active": false,
			"reduced_motion": true,
		}

	var rng_seed: int = DeterministicRNG.seed_from_text(
		"life:%s" % String(instruction.id),
		dna_seed,
	)
	var rng = DeterministicRNG.new(rng_seed)
	var phase: float = rng.range_float(0.0, TAU)
	var period_scale: float = rng.range_float(0.88, 1.14)
	var angular_time: float = (
		elapsed_seconds * TAU / (IDLE_PERIOD_SECONDS * period_scale)
		+ phase
	)
	var idle_wave: float = sin(angular_time) * 0.5 + 0.5
	var pressure: Dictionary = Dictionary(instruction.metadata.get("semantic_pressure", {}))
	var luminosity: float = clampf(
		float(pressure.get("luminosity", instruction.metadata.get("semantic_luminosity", 0.0))),
		0.0,
		1.0,
	)
	var polishing: float = clampf(
		float(pressure.get("polishing", instruction.metadata.get("semantic_polish_factor", 0.0))),
		0.0,
		1.0,
	)
	var energy: float = clampf(float(instruction.energy), 0.0, 1.0)

	var idle_amplitude: float = 0.045 + luminosity * 0.055 + energy * 0.02
	var emission_factor: float = clampf(
		1.0 - idle_amplitude * 0.5 + idle_wave * idle_amplitude,
		MIN_EMISSION_FACTOR,
		MAX_EMISSION_FACTOR,
	)
	var rim_amplitude: float = 0.025 + luminosity * 0.03 + polishing * 0.015
	var rim_factor: float = clampf(
		1.0 - rim_amplitude * 0.45 + idle_wave * rim_amplitude,
		MIN_RIM_FACTOR,
		MAX_RIM_FACTOR,
	)

	var reveal_progress := 1.0
	if reveal_elapsed >= 0.0:
		reveal_progress = _smoothstep01(
			clampf(reveal_elapsed / REVEAL_DURATION_SECONDS, 0.0, 1.0),
		)
	var axial_scale: float = lerpf(MIN_AXIAL_REVEAL_SCALE, 1.0, reveal_progress)
	var radial_scale: float = lerpf(MIN_RADIAL_REVEAL_SCALE, 1.0, reveal_progress)

	var impact_flash := 0.0
	if impact_elapsed >= 0.0 and impact_elapsed < IMPACT_DURATION_SECONDS:
		var impact_progress: float = clampf(
			impact_elapsed / IMPACT_DURATION_SECONDS,
			0.0,
			1.0,
		)
		var envelope: float = sin(impact_progress * PI) * (1.0 - impact_progress * 0.32)
		impact_flash = clampf(
			envelope * (0.22 + luminosity * 0.18 + energy * 0.08),
			0.0,
			MAX_IMPACT_FLASH,
		)

	return {
		"version": VERSION,
		"phase": phase,
		"idle_wave": idle_wave,
		"emission_factor": emission_factor,
		"rim_factor": rim_factor,
		"impact_flash": impact_flash,
		"reveal_progress": reveal_progress,
		"axial_scale": axial_scale,
		"radial_scale": radial_scale,
		"active": reveal_progress < 1.0 or impact_flash > 0.0,
		"reduced_motion": false,
	}


func _smoothstep01(value: float) -> float:
	var bounded: float = clampf(value, 0.0, 1.0)
	return bounded * bounded * (3.0 - 2.0 * bounded)
