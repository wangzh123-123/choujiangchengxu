# 能力规格：prize-catalog

## ADDED Requirements

### Requirement: 本地奖品列表可配置

The system SHALL persist a list of prizes, each with a unique id, display name, and image reference (local path or URL served by the local backend).

#### Scenario: 保存奖品配置

- **WHEN** an authenticated admin submits a valid prize list
- **THEN** the system stores the list in local JSON persistence
- **AND** subsequent reads return the same prize id, name, and image reference

#### Scenario: 拒绝无效奖品

- **WHEN** an admin submits a prize missing name or image reference
- **THEN** the system rejects the write
- **AND** returns an error indicating the missing field

### Requirement: 选择当前抽奖奖品

The system SHALL allow selecting exactly one prize as the current draw target from the configured list.

#### Scenario: 切换当前奖品

- **WHEN** the host selects prize P as current
- **THEN** the public prize screen displays P's name and image
- **AND** draw and preset operations apply to P

#### Scenario: 无当前奖品时禁止开奖

- **WHEN** no current prize is selected
- **THEN** starting a draw MUST be rejected with a clear error
