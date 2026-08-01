extends RefCounted

## Translates species-neutral Evolution Event channels and module sources into
## Crystal-specific geological pressures. The result is canonical metadata;
## geometry and materials may project it, but module names never create meshes
## directly.

const VERSION := "crystal-semantic-pressure-v1"
const PRESSURE_KEYS := [
	"expansion",
	"internal_density",
	"polishing",
	"structural",
	"luminosity",
]


func evaluate(event) -> Dictionary:
	var source_family: String = _source_family(String(event.source), String(event.id))
	var activity: float = clampf(float(event.portal_activity), 0.0, 1.0)
	var expansion: float = (
		0.05
		+ _channel(event, "exploration") * 0.62
		+ _channel(event, "culture") * 0.12
		+ activity * 0.08
	)
	var internal_density: float = (
		0.05
		+ _channel(event, "remembrance") * 0.58
		+ _channel(event, "stability") * 0.18
		+ _channel(event, "significance") * 0.14
		+ activity * 0.05
	)
	var polishing: float = (
		0.04
		+ _channel(event, "culture") * 0.34
		+ _channel(event, "remembrance") * 0.18
		+ _channel(event, "significance") * 0.16
		+ activity * 0.08
	)
	var structural: float = (
		0.06
		+ _channel(event, "achievement") * 0.44
		+ _channel(event, "stability") * 0.28
		+ _channel(event, "significance") * 0.2
		+ activity * 0.06
	)
	var luminosity: float = (
		0.04
		+ _channel(event, "significance") * 0.3
		+ _channel(event, "achievement") * 0.16
		+ _channel(event, "culture") * 0.14
		+ activity * 0.18
	)

	match source_family:
		"map", "travel":
			expansion += 0.28
			polishing += 0.05
		"memories":
			internal_density += 0.3
			polishing += 0.12
		"photos":
			polishing += 0.34
			internal_density += 0.12
		"plans", "goals":
			structural += 0.3
			expansion += 0.04
		"wishlist":
			luminosity += 0.34
			structural += 0.08
		"shopping":
			structural += 0.18
			internal_density += 0.1
		"calendar":
			structural += 0.18
			internal_density += 0.16
			luminosity += 0.08

	var evidence_weight := 1.0 if String(event.evidence) == "verified" else 0.86
	var pressures := {
		"expansion": _bounded(expansion * evidence_weight),
		"internal_density": _bounded(internal_density * evidence_weight),
		"polishing": _bounded(polishing * evidence_weight),
		"structural": _bounded(structural * evidence_weight),
		"luminosity": _bounded(luminosity * evidence_weight),
	}
	var dominant: String = PRESSURE_KEYS[0]
	var dominant_value: float = float(pressures[dominant])
	for key in PRESSURE_KEYS:
		var value: float = float(pressures[key])
		if value > dominant_value:
			dominant = key
			dominant_value = value

	return {
		"version": VERSION,
		"source_family": source_family,
		"dominant": dominant,
		"intensity": dominant_value,
		"pressure": pressures,
	}


func _source_family(source: String, event_id: String) -> String:
	var normalized_source: String = source.to_lower().strip_edges()
	var family: String = normalized_source.get_slice("@", 0)
	var normalized_id: String = event_id.to_lower()
	if family.contains("photo") or normalized_id.contains("photo"):
		return "photos"
	if family.contains("memory"):
		return "memories"
	if family.contains("map"):
		return "map"
	if family.contains("travel"):
		return "travel"
	if family.contains("plan"):
		return "plans"
	if family.contains("goal"):
		return "goals"
	if family.contains("wish"):
		return "wishlist"
	if family.contains("shopping"):
		return "shopping"
	if family.contains("calendar"):
		return "calendar"
	return family if not family.is_empty() else "unknown"


func _channel(event, name: String) -> float:
	return clampf(float(event.channels.get(name, 0.0)), 0.0, 1.0)


func _bounded(value: float) -> float:
	return roundf(clampf(value, 0.0, 1.0) * 1000000.0) / 1000000.0
