extends Node3D

@export var rotation_speed := 0.006
@export var zoom_step := 0.6
@export var minimum_distance := 5.2
@export var maximum_distance := 12.0
@export var target_height := 1.58

@onready var camera: Camera3D = $Camera3D

var distance := 8.9
var pitch := deg_to_rad(-3.0)
var yaw := deg_to_rad(18.0)


func _ready() -> void:
	_apply_camera_transform()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT):
		yaw -= event.relative.x * rotation_speed
		pitch = clampf(pitch - event.relative.y * rotation_speed, deg_to_rad(-38.0), deg_to_rad(20.0))
		_apply_camera_transform()
	elif event is InputEventScreenDrag:
		yaw -= event.relative.x * rotation_speed
		pitch = clampf(pitch - event.relative.y * rotation_speed, deg_to_rad(-38.0), deg_to_rad(20.0))
		_apply_camera_transform()
	elif event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP:
			distance = maxf(minimum_distance, distance - zoom_step)
			_apply_camera_transform()
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			distance = minf(maximum_distance, distance + zoom_step)
			_apply_camera_transform()
	elif event is InputEventMagnifyGesture:
		distance = clampf(distance / maxf(0.2, event.factor), minimum_distance, maximum_distance)
		_apply_camera_transform()


func _apply_camera_transform() -> void:
	rotation = Vector3(pitch, yaw, 0.0)
	camera.position = Vector3(0.0, target_height, distance)
	camera.look_at(Vector3(0.0, target_height, 0.0), Vector3.UP)
