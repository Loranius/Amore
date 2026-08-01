extends SceneTree

const OrbitCamera = preload("res://scripts/runtime/orbit_camera.gd")

var failures: Array[String] = []
var activations: Array[String] = []
var interactions: Array[String] = []


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	var rig = Node3D.new()
	rig.name = "CameraRig"
	rig.set_script(OrbitCamera)
	var camera := Camera3D.new()
	camera.name = "Camera3D"
	rig.add_child(camera)
	root.add_child(rig)
	await process_frame

	rig.connect("portal_activate", _on_portal_activate)
	rig.connect("portal_interaction", _on_portal_interaction)

	var tap_down := InputEventScreenTouch.new()
	tap_down.index = 0
	tap_down.position = Vector2(120.0, 180.0)
	tap_down.pressed = true
	rig.call("_unhandled_input", tap_down)

	var tap_up := InputEventScreenTouch.new()
	tap_up.index = 0
	tap_up.position = Vector2(122.0, 181.0)
	tap_up.pressed = false
	rig.call("_unhandled_input", tap_up)
	_expect(activations == ["tap"], "short touch must activate the portal exactly once")
	_expect(interactions == ["tap"], "short touch must produce one tap interaction")

	var drag_down := InputEventScreenTouch.new()
	drag_down.index = 0
	drag_down.position = Vector2(160.0, 210.0)
	drag_down.pressed = true
	rig.call("_unhandled_input", drag_down)

	var drag := InputEventScreenDrag.new()
	drag.index = 0
	drag.position = Vector2(228.0, 210.0)
	drag.relative = Vector2(68.0, 0.0)
	rig.call("_unhandled_input", drag)

	var drag_up := InputEventScreenTouch.new()
	drag_up.index = 0
	drag_up.position = Vector2(228.0, 210.0)
	drag_up.pressed = false
	rig.call("_unhandled_input", drag_up)
	_expect(activations == ["tap"], "orbit drag must not activate the portal")
	_expect(interactions == ["tap", "orbit"], "completed orbit drag must produce evidence")

	var wheel := InputEventMouseButton.new()
	wheel.button_index = MOUSE_BUTTON_WHEEL_UP
	wheel.pressed = true
	rig.call("_unhandled_input", wheel)
	_expect(interactions == ["tap", "orbit", "zoom"], "zoom must produce interaction evidence")

	var keyboard := InputEventKey.new()
	keyboard.keycode = KEY_ENTER
	keyboard.pressed = true
	rig.call("_unhandled_input", keyboard)
	_expect(
		activations == ["tap", "keyboard"],
		"keyboard activation must remain available for accessibility",
	)
	_expect(
		interactions == ["tap", "orbit", "zoom", "keyboard"],
		"keyboard activation must be represented in device evidence",
	)

	rig.queue_free()
	await process_frame

	if failures.is_empty():
		print("PASS: Godot portal production cutover; Phase 13 interaction evidence")
		quit(0)
		return

	for failure in failures:
		push_error(failure)
	quit(1)


func _on_portal_activate(source: String) -> void:
	activations.append(source)


func _on_portal_interaction(kind: String) -> void:
	interactions.append(kind)


func _expect(condition: bool, message: String) -> void:
	if not condition:
		failures.append(message)
