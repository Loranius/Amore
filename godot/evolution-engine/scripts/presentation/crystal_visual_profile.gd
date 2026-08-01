extends RefCounted

## Renderer-only Phase 10 visual profile.
## It derives palette and presentation accents from canonical instruction data
## without mutating Growth Instructions, history or colony projection.

const DeterministicRNG = preload("res://scripts/core/deterministic_rng.gd")

const VERSION := "crystal-visual-profile-v1"

const PALETTE: Array[Color] = [
	Color(0.60, 0.38, 0.86, 1.0), # amethyst violet
	Color(0.31, 0.50, 0.88, 1.0), # sapphire blue
	Color(0.24, 0.69, 0.78, 1.0), # aqua
	Color(0.40, 0.76, 0.64, 1.0), # seafoam mint
	Color(0.88, 0.62, 0.31, 1.0), # amber
	Color(0.84, 0.43, 0.55, 1.0), # rose mineral
]

const CLOUDY_BASE := Color(0.47, 0.49, 0.58, 1.0)
const GLASS_TIP := Color(0.90, 0.93, 1.0, 1.0)
const FOUNDATION_MINERAL := Color(0.12, 0.095, 0.145, 1.0)


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
	color = color.lerp(GLASS_TIP, polishing * 0.055)
	color = color.lightened(luminosity * 0.045)
	return color


func facet_color(instruction, height_ratio: float, facet_index: int) -> Color:
	var t: float = clampf(height_ratio, 0.0, 1.0)
	var color: Color = base_color(instruction)
	var cloudy_mix: float = (1.0 - smoothstep(0.0, 0.38, t)) * 0.34
	color = color.lerp(CLOUDY_BASE, cloudy_mix)
	color = color.darkened((1.0 - t) * 0.075)
	color = color.lerp(GLASS_TIP, pow(t, 3.2) * 0.18)

	var phase_seed: int = DeterministicRNG.seed_from_text(String(instruction.id), 301)
	var variation: float = sin(
		float(facet_index) * 1.71 + float(phase_seed % 997) * 0.013,
	) * 0.032
	if variation >= 0.0:
		color = color.lightened(variation)
	else:
		color = color.darkened(-variation)
	return color


func foundation_color(mother) -> Color:
	return FOUNDATION_MINERAL.lerp(base_color(mother), 0.18)


func default_yaw_degrees(dna_seed: int) -> float:
	var rng = DeterministicRNG.new(
		DeterministicRNG.seed_from_text("phase10:default-yaw", dna_seed),
	)
	return rng.range_float(-13.0, 13.0)


func default_tilt_degrees(dna_seed: int) -> float:
	var rng = DeterministicRNG.new(
		DeterministicRNG.seed_from_text("phase10:default-tilt", dna_seed),
	)
	return rng.range_float(-1.8, 1.2)


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
