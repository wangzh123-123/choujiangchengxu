# 能力规格：hard-preset-draw

## ADDED Requirements

### Requirement: 按奖品硬内定

The system SHALL allow an authenticated admin to preset exactly zero or one winner participant for each prize.

#### Scenario: 保存内定

- **WHEN** admin sets participant U as preset winner for prize P
- **AND** U has not already won any prize
- **THEN** the preset is persisted for P

### Requirement: 有内定则必中

When a prize has a preset winner, the draw result MUST be that participant; scrolling is presentation only.

#### Scenario: 硬内定开奖

- **WHEN** prize P has preset winner U
- **AND** the host starts a draw for P
- **THEN** the recorded winner is U
- **AND** the public scroll settles on U before the winner screen

### Requirement: 无内定则随机

When a prize has no preset, the system SHALL choose uniformly at random among eligible participants.

#### Scenario: 随机开奖

- **WHEN** prize P has no preset
- **AND** at least one eligible participant exists
- **AND** the host starts a draw for P
- **THEN** the winner is one eligible participant chosen at random

### Requirement: 不可重复中奖

A participant who has already won any prize MUST be excluded from later eligible pools. Presetting or drawing an already-won participant MUST be rejected.

#### Scenario: 已中奖者不可再中

- **WHEN** participant U has already won a prize
- **AND** admin attempts to preset U for another prize
- **THEN** the system rejects the preset with a clear error

#### Scenario: 开奖后移出奖池

- **WHEN** participant U wins prize P
- **THEN** U is not eligible for subsequent prize draws

### Requirement: 开奖前置条件

The system MUST reject starting a draw when there is no current prize, or when the eligible pool is empty.

#### Scenario: 无人可抽时拒绝开奖

- **WHEN** the eligible participant pool for the current prize is empty
- **AND** the host starts a draw
- **THEN** the system rejects the draw with a clear error
