extends RefCounted

## Seeded random stream scoped to one deterministic growth decision.
## Canonical reconstruction must use the same Godot engine version.

var _rng := RandomNumberGenerator.new()


func _init(seed_value: int = 1) -> void:
	reseed(seed_value)


func reseed(seed_value: int) -> void:
	_rng.seed = normalize_seed(seed_value)


func next_float() -> float:
	return _rng.randf()


func range_float(minimum: float, maximum: float) -> float:
	return _rng.randf_range(minimum, maximum)


func range_int(minimum: int, maximum: int) -> int:
	return _rng.randi_range(minimum, maximum)


func signed_float(amplitude: float = 1.0) -> float:
	return range_float(-amplitude, amplitude)


func unit_vector() -> Vector3:
	var y := range_float(-1.0, 1.0)
	var angle := range_float(0.0, TAU)
	var planar := sqrt(maxf(0.0, 1.0 - y * y))
	return Vector3(cos(angle) * planar, y, sin(angle) * planar)


func direction_in_cone(axis: Vector3, maximum_angle: float) -> Vector3:
	var safe_axis := axis.normalized() if axis.length_squared() > 0.000001 else Vector3.UP
	var tangent := safe_axis.cross(Vector3.UP)
	if tangent.length_squared() < 0.000001:
		tangent = safe_axis.cross(Vector3.RIGHT)
	tangent = tangent.normalized()
	var bitangent := safe_axis.cross(tangent).normalized()
	var angle := range_float(0.0, maximum_angle)
	var spin := range_float(0.0, TAU)
	return (
		safe_axis * cos(angle)
		+ tangent * sin(angle) * cos(spin)
		+ bitangent * sin(angle) * sin(spin)
	).normalized()


static func seed_from_text(text: String, salt: int = 0) -> int:
	# FNV-1a followed by a small avalanche mix. This avoids relying on
	# implementation-defined object hashes for canonical IDs.
	var value: int = 2166136261
	for byte in text.to_utf8_buffer():
		value = int((value ^ int(byte)) * 16777619) & 0x7fffffff
	return normalize_seed(value ^ salt)


static func normalize_seed(value: int) -> int:
	var mixed := value & 0x7fffffff
	mixed = int((mixed ^ (mixed >> 16)) * 0x45d9f3b) & 0x7fffffff
	mixed = int((mixed ^ (mixed >> 16)) * 0x45d9f3b) & 0x7fffffff
	mixed = mixed ^ (mixed >> 16)
	return maxi(1, mixed & 0x7fffffff)
