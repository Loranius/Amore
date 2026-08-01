extends SceneTree

const RuntimeQualityGovernor = preload("res://scripts/runtime/runtime_quality_governor.gd")
const CrystalLifeEngine = preload("res://scripts/life/crystal_life_engine.gd")

var failures: Array[String] = []


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	var governor = RuntimeQualityGovernor.new()
	_expect(
		governor.select_quality({
			"device_memory_gb": 12.0,
			"hardware_concurrency": 8,
			"viewport_width": 412,
			"viewport_height": 915,
			"device_pixel_ratio": 2.5,
		}, "auto") == RuntimeQualityGovernor.QUALITY_HIGH,
		"capable mobile profile must select high quality",
	)
	_expect(
		governor.select_quality({
			"device_memory_gb": 8.0,
			"hardware_concurrency": 8,
			"viewport_width": 412,
			"viewport_height": 915,
			"device_pixel_ratio": 3.5,
		}, "auto") == RuntimeQualityGovernor.QUALITY_BALANCED,
		"high-DPR mobile profile must select balanced quality",
	)
	_expect(
		governor.select_quality({
			"device_memory_gb": 4.0,
			"hardware_concurrency": 4,
			"viewport_width": 412,
			"viewport_height": 915,
			"device_pixel_ratio": 2.5,
		}, "auto") == RuntimeQualityGovernor.QUALITY_ECONOMY,
		"constrained mobile profile must select economy quality",
	)
	_expect(
		governor.select_quality({}, "high") == RuntimeQualityGovernor.QUALITY_HIGH,
		"explicit runtime quality must override capability detection",
	)

	var settings: Dictionary = governor.configure({}, "high")
	_expect(String(settings.get("quality", "")) == "high", "high settings were not applied")
	for _sample in range(RuntimeQualityGovernor.LOW_SAMPLE_LIMIT - 1):
		_expect(not governor.observe_fps(18.0), "quality changed before the low-FPS window completed")
	_expect(governor.observe_fps(18.0), "quality did not downgrade after sustained low FPS")
	_expect(governor.current_quality() == "balanced", "high quality did not downgrade to balanced")
	for _sample in range(RuntimeQualityGovernor.LOW_SAMPLE_LIMIT):
		governor.observe_fps(18.0)
	_expect(governor.current_quality() == "economy", "balanced quality did not downgrade to economy")
	for _sample in range(RuntimeQualityGovernor.HEALTHY_SAMPLE_LIMIT):
		governor.observe_fps(55.0)
	_expect(governor.current_quality() == "balanced", "economy quality did not recover after a healthy window")

	settings = governor.current_settings()
	_expect(float(settings.get("render_scale", 0.0)) >= 0.5, "render scale escaped its mobile lower bound")
	_expect(float(settings.get("render_scale", 2.0)) <= 1.0, "render scale escaped its upper bound")
	_expect(float(settings.get("life_hz", 0.0)) >= 10.0, "Life Engine update rate escaped its lower bound")
	_expect(float(settings.get("life_hz", 100.0)) <= 60.0, "Life Engine update rate escaped its upper bound")

	var holder := Node.new()
	holder.name = "MobileRuntimeSmokeHolder"
	root.add_child(holder)
	var life_engine = CrystalLifeEngine.new()
	holder.add_child(life_engine)
	life_engine.configure(582013, false)
	life_engine.set_update_hz(20.0)
	_expect(is_equal_approx(life_engine.update_hz(), 20.0), "Life Engine ignored the economy update rate")
	life_engine.set_runtime_paused(true)
	_expect(life_engine.is_runtime_paused(), "Life Engine did not suspend in the background")
	_expect(not life_engine.is_processing(), "suspended Life Engine still processes frames")
	life_engine.set_runtime_paused(false)
	_expect(not life_engine.is_runtime_paused(), "Life Engine did not resume")
	_expect(life_engine.is_processing(), "resumed Life Engine did not restore processing")

	holder.queue_free()
	await process_frame

	if failures.is_empty():
		print("PASS: Phase 12 mobile runtime hardening")
		quit(0)
		return
	for failure in failures:
		push_error(failure)
	quit(1)


func _expect(condition: bool, message: String) -> void:
	if not condition:
		failures.append(message)
