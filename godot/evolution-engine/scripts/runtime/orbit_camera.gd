extends Node3D

signal portal_activate(source: String)

@export var rotation_speed := 0.006
@export var zoom_step := 0.6
@export var minimum_distance := 5.2
@export var maximum_distance := 12.0
@export var target_height := 1.58
@export var tap_max_distance := 18.0
@export var tap_max_duration_seconds := 0.42

@onready var camera: Camera3D = $Camera3D

var distance := 8.9
var pitch := deg_to_rad(-3.0)
var yaw := deg_to_rad(18.0)
var _pointer_active := false
var _touch_active := false
var _pointer_started_at_ms := 0
var _pointer_distance := 0.0


func _ready() -> void:
	_apply_camera_transform()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT):
		if _pointer_active:
			_pointer_distance += event.relative.length()
		yaw -= event.relative.x * rotation_speed
		pitch = clampf(pitch - event.relative.y * rotation_speed, deg_to_rad(-38.0), deg_to_rad(20.0))
		_apply_camera_transform()
	elif event is InputEventScreenDrag:
		if _pointer_active:
			_pointer_distance += event.relative.length()
		yaw -= event.relative.x * rotation_speed
		pitch = clampf(pitch - event.relative.y * rotation_speed, deg_to_rad(-38.0), deg_to_rad(20.0))
		_apply_camera_transform()
	elif event is InputEventScreenTouch:
		if event.pressed:
			_touch_active = true
			_begin_pointer()
		else:
			_finish_pointer("tap")
			_touch_active = false
	elif event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_LEFT:
			if event.pressed and not _touch_active:
				_begin_pointer()
			elif not event.pressed and _pointer_active and not _touch_active:
				_finish_pointer("tap")
		elif event.pressed and event.button_index == MOUSE_BUTTON_WHEEL_UP:
			distance = maxf(minimum_distance, distance - zoom_step)
			_apply_camera_transform()
		elif event.pressed and event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			distance = minf(maximum_distance, distance + zoom_step)
			_apply_camera_transform()
	elif event is InputEventMagnifyGesture:
		distance = clampf(distance / maxf(0.2, event.factor), minimum_distance, maximum_distance)
		_apply_camera_transform()
	elif event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_ENTER or event.keycode == KEY_SPACE:
			portal_activate.emit("keyboard")


func _begin_pointer() -> void:
	_pointer_active = true
	_pointer_started_at_ms = Time.get_ticks_msec()
	_pointer_distance = 0.0


func _finish_pointer(source: String) -> void:
	if not _pointer_active:
		return
	var elapsed_seconds := float(Time.get_ticks_msec() - _pointer_started_at_ms) / 1000.0
	var is_tap := (
		elapsed_seconds <= tap_max_duration_seconds
		and _pointer_distance <= tap_max_distance
	)
	_pointer_active = false
	_pointer_distance = 0.0
	if is_tap:
		portal_activate.emit(source)


func _apply_camera_transform() -> void:
	rotation = Vector3(pitch, yaw, 0.0)
	camera.position = Vector3(0.0, target_height, distance)
	camera.look_at(Vector3(0.0, target_height, 0.0), Vector3.UP)
