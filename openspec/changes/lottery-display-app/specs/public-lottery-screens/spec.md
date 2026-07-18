# 能力规格：public-lottery-screens

## ADDED Requirements

### Requirement: 对外四屏

The system SHALL provide four public screens: prize showcase, enrollment (fake QR), drawing scroll, and winner reveal.

#### Scenario: 四屏均可到达

- **WHEN** the host uses the control bar to navigate
- **THEN** each of the four screens can be shown
- **AND** only one public screen is primary at a time

### Requirement: 奖品展示屏

The prize showcase screen SHALL display the current prize's image and name.

#### Scenario: 展示当前奖品

- **WHEN** the current prize is P and the prize screen is active
- **THEN** P's image and name are visible to viewers

### Requirement: 抽奖滚动屏

The drawing screen SHALL visually match the prize showcase style and SHALL include a scrolling ticker that cycles participant names during the draw.

#### Scenario: 滚动播放用户名

- **WHEN** a draw is in progress for the current prize
- **THEN** participant names scroll in a repeating ticker
- **AND** the motion uses accelerate-then-decelerate settling before reveal

### Requirement: 中奖展示屏

The winner screen SHALL display the drawn prize and the winning participant.

#### Scenario: 展示中奖结果

- **WHEN** a draw completes with winner W for prize P
- **THEN** the winner screen shows P and W
- **AND** applies a highlight emphasis animation

### Requirement: 主持人控制条

The system SHALL provide a host control bar to switch screens, select current prize, and start a draw, and SHALL allow hiding the control bar.

#### Scenario: 切屏与开抽

- **WHEN** the host clicks next/previous or a screen shortcut on the control bar
- **THEN** the corresponding public screen becomes active

#### Scenario: 隐藏控制条

- **WHEN** the host hides the control bar
- **THEN** the control bar is not visible on the public display
- **AND** the host can reveal it again via the documented restore action

### Requirement: 轻量切屏动效

Public screen transitions SHALL use a fade in/out effect without sound or particle effects.

#### Scenario: 切屏淡入淡出

- **WHEN** the active public screen changes
- **THEN** the transition uses fade in/out
