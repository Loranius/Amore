extends RefCounted

## Renderer-only Phase 10 visual profile.
## It derives palette and presentation accents from canonical instruction data
## without mutating Growth Instructions, history or colony projection.

const DeterministicRNG = preload("res://scripts/core/deterministic_rng.gd")

const VERSION := "crystal-visual-profile-v2"

const PALETTE: Array[Color] = [
	Color(0.52, 0.36, 0.72, 1.0), # amethyst violet
	Color(0.28, 0.45, 0.70, 1.0), # sapphire blue
	Color(0.23, 0.58, 0.65, 1.0), # aqua
	Color(0.36, 0.64, 0.55, 1.0), # seafoam mint
	Color(0.72, 0.50, 0.28, 1.0), # amber
	Color(0.72, 0.37, 0.47, 1.0), # rose mineral
]

const CLOUDY_BASE := Color(0.38, 0.40, 0.47, 1.0)
const GLASS_TIP := Color(0.83, 0.87, 0.94, 1.0)
const FOUNDATION_MINERAL := Color(0.105, 0.09, 0.13, 1.0)


func base_color(instruction) -> Color:
	var role: String = String(instruction.metadata.get("role", ""))
	if String(instruction.id) == "crystal:mother" or role == "mother":
		return PALETTE[0]

	var dominant: String = String(
		instruction.metadata.get("semantic_dominant", ""),
	)
	var palette_index := _dominant_palette_index(dominant)
	if palette_index < 0:
		palette_index = _identity_palette_index(String(instruction.id), role)

	var color: Color = PALETTE[palette_index]
	var pressure: Dictionary = Dictionary(
		instruction.metadata.get("semantic_pressure", {}),
	)
	var polishing: float = clampf(float(pressure.get("polishing", 0.0)), 0.0, 1.0)
	var luminosity: float = clampf(
		float(pressure.get("luminosity", instruction.metadata.get("semantic_luminosity", 0.0))),
		0.0,
		1.0,
	)
	color = color.lerp(GLASS_TIP, polishing * 0.045)
	color = color.lightened(luminosity * 0.025)
	return color


func facet_color(instruction, height_ratio: float, facet_index: int) -> Color:
	var t: float = clampf(height_ratio, 0.0, 1.0)
	var color: Color = base_color(instruction)
	var cloudy_mix: float = (1.0 - smoothstep(0.0, 0.44, t)) * 0.44
	color = color.lerp(CLOUDY_BASE, cloudy_mix)
	color = color.darkened((1.0 - t) * 0.115)
	color = color.lerp(GLASS_TIP, pow(t, 3.0) * 0.28)

	var phase_seed: int = DeterministicRNG.seed_from_text(String(instruction.id), 301)
	var variation: float = sin(
		float(facet_index) * 1.71 + float(phase_seed % 997) * 0.013,
	) * 0.025
	if variation >= 0.0:
		color = color.lightened(variation)
	else:
		color = color.darkened(-variation)
	return color


func foundation_color(mother) -> Color:
	return FOUNDATION_MINERAL.lerp(base_color(mother), 0.14)


func body_bias(instruction) -> Vector3:
	var rng = DeterministicRNG.new(
		DeterministicRNG.seed_from_text("phase10:body-bias:%s" % String(instruction.id), 907),
	)
	var role: String = String(instruction.metadata.get("role", ""))
	var amplitude: float = 0.055 if String(instruction.id) == "crystal:mother" or role == "mother" else 0.028
	return Vector3(
		rng.range_float(-amplitude, amplitude),
		0.0,
		rng.range_float(-amplitude, amplitude),
	)


func default_yaw_degrees(dna_seed: int) -> float:
	var rng = DeterministicRNG.new(
		DeterministicRNG.seed_from_text("phase10:default-yaw", dna_seed),
	)
	return rng.range_float(24.0, 34.0)


func default_tilt_degrees(dna_seed: int) -> float:
	var rng = DeterministicRNG.new(
		DeterministicRNG.seed_from_text("phase10:default-tilt", dna_seed),
	)
	return rng.range_float(-1.3, 0.4)


func _dominant_palette_index(dominant: String) -> int:
	match dominant:
		"expansion":
			return 2
		"internal_density":
			return 0
		"polishing":
			return 3
		"structural":
			return 4
		"luminosity":
			return 5
		_:
			return -1


func _identity_palette_index(instruction_id: String, role: String) -> int:
	var seed_value: int = DeterministicRNG.seed_from_text(
		"phase10:%s:%s" % [role, instruction_id],
		719,
	)
	if role == "basal-crown":
		return 1 + seed_value % (PALETTE.size() - 1)
	return seed_value % PALETTE.size()
