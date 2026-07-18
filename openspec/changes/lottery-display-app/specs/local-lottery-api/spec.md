# 能力规格：local-lottery-api

## ADDED Requirements

### Requirement: 本地 API 与 JSON 持久化

The system SHALL expose a local Express HTTP API that reads and writes prizes, participants, presets, draw results, and runtime session state to local JSON files.

#### Scenario: 重启后数据仍在

- **WHEN** prizes, participants, and presets were saved
- **AND** the server process is restarted
- **THEN** subsequent API reads return the previously saved data

### Requirement: Admin 口令保护

Admin-only mutating endpoints and the `/admin` UI MUST require a configured local passphrase before allowing preset or prize-configuration changes.

#### Scenario: 无口令拒绝管理写操作

- **WHEN** a client calls an admin write API without a valid passphrase session
- **THEN** the system rejects the request
- **AND** does not modify persisted data

#### Scenario: 口令通过后可管理

- **WHEN** the operator submits the correct local passphrase
- **THEN** admin prize and preset operations are allowed for that session

### Requirement: 公开读与受控写分离

Public screens MAY read current prize, enrollment display data, and draw presentation state without admin passphrase. Writes that change prizes, presets, or passphrase-gated config MUST require admin auth.

#### Scenario: 观众可读当前奖品

- **WHEN** an unauthenticated client requests the current public prize view model
- **THEN** the system returns the current prize name and image reference without requiring the admin passphrase
