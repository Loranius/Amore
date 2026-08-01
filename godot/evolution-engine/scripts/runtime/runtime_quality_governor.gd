extends RefCounted

## Runtime-only quality selection. This class may change presentation cost but
## must never alter Artifact DNA, Evolution Events, canonical instructions,
## renderer projection or append-only history.

const VERSION := "runtime-quality-governor-v1"
const QUALITY_HIGH := "high"
const QUALITY_BALANCED := "balanced"
const QUALITY_ECONOMY := "economy"
const VALID_QUALITIES := [QUALITY_HIGH, QUALITY_BALANCED, QUALITY_ECONOMY]
const LOW_FPS_THRESHOLD := 24.0
const HEALTHY_FPS_THRESHOLD := 48.0
const LOW_SAMPLE_LIMIT := 4
const HEALTHY_SAMPLE_LIMIT := 12

var _quality := QUALITY_BALANCED
var _low_samples := 0
var _healthy_samples := 0


func configure(capabilities: Dictionary, requested: String = "auto") -> Dictionary:
	_quality = select_quality(capabilities, requested)
	_low_samples = 0
	_healthy_samples = 0
	return current_settings()


func select_quality(capabilities: Dictionary, requested: String = "auto") -> String:
	var normalized := requested.strip_edges().to_lower()
	if normalized in VALID_QUALITIES:
		return normalized

	var memory_gb := float(capabilities.get("device_memory_gb", 0.0))
	var cores := int(capabilities.get("hardware_concurrency", 0))
	var width := maxf(1.0, float(capabilities.get("viewport_width", 1.0)))
	var height := maxf(1.0, float(capabilities.get("viewport_height", 1.0)))
	var dpr := clampf(float(capabilities.get("device_pixel_ratio", 1.0)), 1.0, 4.0)
	var pixel_load := width * height * dpr * dpr

	if (
		(memory_gb > 0.0 and memory_gb <= 4.0)
		or (cores > 0 and cores <= 4)
		or pixel_load >= 6_000_000.0
	):
		return QUALITY_ECONOMY
	if (
		memory_gb >= 8.0
		and cores >= 8
		and pixel_load <= 4_500_000.0
	):
		return QUALITY_HIGH
	return QUALITY_BALANCED


func observe_fps(fps: float) -> bool:
	if fps <= 0.0:
		return false

	if fps < LOW_FPS_THRESHOLD:
		_low_samples += 1
		_healthy_samples = 0
	elif fps >= HEALTHY_FPS_THRESHOLD:
		_healthy_samples += 1
		_low_samples = 0
	else:
		_low_samples = 0
		_healthy_samples = 0

	if _low_samples >= LOW_SAMPLE_LIMIT:
		_low_samples = 0
		_healthy_samples = 0
		return _downgrade()

	# Automatic recovery is intentionally conservative. Economy can recover to
	# balanced after a sustained healthy window; balanced never promotes itself
	# to high because battery and thermal stability are preferred on mobile.
	if _healthy_samples >= HEALTHY_SAMPLE_LIMIT and _quality == QUALITY_ECONOMY:
		_low_samples = 0
		_healthy_samples = 0
		_quality = QUALITY_BALANCED
		return true
	return false


func current_quality() -> String:
	return _quality


func current_settings() -> Dictionary:
	match _quality:
		QUALITY_HIGH:
			return {
				"quality": QUALITY_HIGH,
				"render_scale": 1.0,
				"life_hz": 60.0,
				"shadows": true,
				"glow": true,
			}
		QUALITY_ECONOMY:
			return {
				"quality": QUALITY_ECONOMY,
				"render_scale": 0.72,
				"life_hz": 20.0,
				"shadows": false,
				"glow": false,
			}
		_:
			return {
				"quality": QUALITY_BALANCED,
				"render_scale": 0.86,
				"life_hz": 30.0,
				"shadows": true,
				"glow": true,
			}


func snapshot() -> Dictionary:
	return {
		"version": VERSION,
		"quality": _quality,
		"low_samples": _low_samples,
		"healthy_samples": _healthy_samples,
		"settings": current_settings(),
	}


func _downgrade() -> bool:
	if _quality == QUALITY_HIGH:
		_quality = QUALITY_BALANCED
		return true
	if _quality == QUALITY_BALANCED:
		_quality = QUALITY_ECONOMY
		return true
	return false
