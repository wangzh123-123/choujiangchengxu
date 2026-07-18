# 能力规格：participant-enrollment

## ADDED Requirements

### Requirement: 手动添加抽奖用户

The system SHALL allow adding a participant with a non-empty `id` and a non-empty display `name` from the fake QR enrollment screen.

#### Scenario: 成功添加用户

- **WHEN** the host submits a new participant with unique name and non-empty id
- **THEN** the participant is persisted
- **AND** appears in the eligible pool for draws of prizes they have not won

### Requirement: 名称重复须拒绝

The system MUST reject adding a participant whose `name` already exists (exact match) and MUST prompt the operator to re-enter a different name.

#### Scenario: 重名添加被拒绝

- **WHEN** a participant named "张三" already exists
- **AND** the host attempts to add another participant with name "张三"
- **THEN** the system does not create a duplicate
- **AND** returns a user-visible message requiring a different name

### Requirement: 假二维码展示

The system SHALL show a non-functional QR placeholder on the enrollment screen (static image or decorative code), without requiring real scan ingestion in this version.

#### Scenario: 展示假二维码

- **WHEN** the public enrollment screen is shown
- **THEN** a QR placeholder is visible
- **AND** an add-participant control remains available to the host
