extends Node

## Runtime-only presentation controller. It owns duplicated materials and local
## Node3D transforms, never canonical Growth Instructions or EvolutionState.

const CrystalLifeProfile = preload("res://scripts/life/crystal_life_profile.gd")

const VERSION := "crystal-life-engine-v1"
const MAX_EMISSION_ENERGY := 0.045
const MAX_RIM_STRENGTH := 0.22

var _profile = CrystalLifeProfile.new()
var _dna_seed := 1
var _elapsed := 0.0
var _reduced_motion := false
var _entries: Dictionary = {}


func configure(dna_seed: int, reduced_motion: bool) -> void:
	_dna_seed = dna_seed
	_reduced_motion = reduced_motion
	set_process(not _reduced_motion)
	if _reduced_motion:
		_reset_to_static()


func register_instance(
	instance: MeshInstance3D,
	instruction,
	reveal_growth: bool = false,
	impact_pulse: bool = false,
) -> bool:
	if instance == null or instruction == null:
		return false
	var material := _duplicate_material(instance)
	if material == null:
		return false

	var reveal_started_at := _elapsed if reveal_growth and not _reduced_motion else -1.0
	var impact_started_at := _elapsed if impact_pulse and not _reduced_motion else -1.0
	_entries[String(instruction.id)] = {
		"instance": instance,
		"instruction": instruction,
		"material": material,
		"base_emission": material.emission_energy_multiplier,
		"base_rim": material.rim,
		"reveal_started_at": reveal_started_at,
		"impact_started_at": impact_started_at,
	}
	if _reduced_motion:
		instance.scale = Vector3.ONE
	else:
		_apply_entry(_entries[String(instruction.id)])
	return true


func advance(delta: float) -> void:
	if _reduced_motion:
		return
	_elapsed += maxf(delta, 0.0)
	var expired_ids: Array[String] = []
	for instruction_id in _entries:
		var entry: Dictionary = _entries[instruction_id]
		var instance = entry.get("instance")
		if not is_instance_valid(instance):
			expired_ids.append(String(instruction_id))
			continue
		_apply_entry(entry)
	for instruction_id in expired_ids:
		_entries.erase(instruction_id)


func entry_count() -> int:
	return _entries.size()


func is_reduced_motion() -> bool:
	return _reduced_motion


func life_snapshot() -> Dictionary:
	return {
		"version": VERSION,
		"profile_version": CrystalLifeProfile.VERSION,
		"entries": _entries.size(),
		"elapsed": _elapsed,
		"reduced_motion": _reduced_motion,
	}


func _process(delta: float) -> void:
	advance(delta)


func _apply_entry(entry: Dictionary) -> void:
	var instance := entry.get("instance") as MeshInstance3D
	var instruction = entry.get("instruction")
	var material := entry.get("material") as StandardMaterial3D
	if instance == null or instruction == null or material == null:
		return

	var reveal_started_at: float = float(entry.get("reveal_started_at", -1.0))
	var impact_started_at: float = float(entry.get("impact_started_at", -1.0))
	var reveal_elapsed: float = (
		_elapsed - reveal_started_at if reveal_started_at >= 0.0 else -1.0
	)
	var impact_elapsed: float = (
		_elapsed - impact_started_at if impact_started_at >= 0.0 else -1.0
	)
	var sample: Dictionary = _profile.sample(
		_dna_seed,
		instruction,
		_elapsed,
		reveal_elapsed,
		impact_elapsed,
		false,
	)

	var radial_scale: float = float(sample.get("radial_scale", 1.0))
	var axial_scale: float = float(sample.get("axial_scale", 1.0))
	instance.scale = Vector3(radial_scale, axial_scale, radial_scale)

	var base_emission: float = float(entry.get("base_emission", 0.0))
	var base_rim: float = float(entry.get("base_rim", 0.0))
	var impact_flash: float = float(sample.get("impact_flash", 0.0))
	material.emission_energy_multiplier = clampf(
		base_emission * float(sample.get("emission_factor", 1.0))
		+ impact_flash * 0.018,
		0.0,
		MAX_EMISSION_ENERGY,
	)
	material.rim = clampf(
		base_rim * float(sample.get("rim_factor", 1.0))
		+ impact_flash * 0.025,
		0.0,
		MAX_RIM_STRENGTH,
	)

	if reveal_elapsed >= CrystalLifeProfile.REVEAL_DURATION_SECONDS:
		entry["reveal_started_at"] = -1.0
	if impact_elapsed >= CrystalLifeProfile.IMPACT_DURATION_SECONDS:
		entry["impact_started_at"] = -1.0


func _duplicate_material(instance: MeshInstance3D) -> StandardMaterial3D:
	var array_mesh := instance.mesh as ArrayMesh
	if array_mesh == null or array_mesh.get_surface_count() == 0:
		return null
	var source := array_mesh.surface_get_material(0) as StandardMaterial3D
	if source == null:
		return null
	var material := source.duplicate(true) as StandardMaterial3D
	instance.material_override = material
	return material


func _reset_to_static() -> void:
	for instruction_id in _entries:
		var entry: Dictionary = _entries[instruction_id]
		var instance := entry.get("instance") as MeshInstance3D
		var material := entry.get("material") as StandardMaterial3D
		if is_instance_valid(instance):
			instance.scale = Vector3.ONE
		if material != null:
			material.emission_energy_multiplier = float(entry.get("base_emission", 0.0))
			material.rim = float(entry.get("base_rim", 0.0))
		entry["reveal_started_at"] = -1.0
		entry["impact_started_at"] = -1.0
