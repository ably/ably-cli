# Ably CLI Test Structure

This directory contains test suites for the Ably CLI at different levels:

## Test Levels

### Unit Tests

Located in `test/unit/`, these test individual components in isolation with all dependencies mocked. They cover:

- Core CLI functionality
- Command parsing and flag handling
- Authentication flows
- Error handling
- Output formatting

### Integration Tests

Located in `test/integration/`, these test commands with mocked external APIs (Ably API/SDK). They verify:

- Command interactions
- Correct data flow between components
- Flag combinations and option handling
- Input validation

### End-to-End (E2E) Tests

Located in `test/e2e/`, these use real API calls to Ably. They verify:

- Real-world behavior
- Actual API interactions
- Message publishing and retrieval
- Channel functionality

## Running E2E Tests

The E2E tests require a real Ably API key to be set as an environment variable:

```bash
# Set environment variable with your Ably API key
export E2E_ABLY_API_KEY="your_app_id.your_key_id:your_key_secret"

# Run E2E tests
pnpm test test/e2e/
```

If no API key is provided, the E2E tests will be skipped.

### E2E Test Design

Our E2E tests follow these best practices:

1. **Unique channel names**: Each test uses a unique channel name with a UUID to avoid collisions between test runs.

2. **Test isolation**: Tests set up their own data and don't rely on pre-existing state.

3. **Publish and verify**: For history tests, data is published first and then verified to ensure a complete test cycle.

4. **Error handling**: Tests include additional error information to simplify troubleshooting.

## Running Tests

### Quick Start

Run all tests (unit, integration, and e2e):
```bash
pnpm test
```

Run only unit tests (fastest):
```bash
pnpm test:unit
```

Run only integration tests:
```bash
pnpm test:integration
```

Run only e2e tests:
```bash
pnpm test:e2e
```

### Specific Test Suites

Run e2e tests by feature:
```bash
pnpm test:e2e:channels  # Channel-related tests
pnpm test:e2e:rooms     # Rooms tests
pnpm test:e2e:spaces    # Spaces tests
pnpm test:e2e:auth      # Authentication tests
pnpm test:e2e:control   # Control API tests
```

### Web CLI Tests (Playwright)

Run all web CLI browser tests:
```bash
pnpm test:web-cli
```

Run web CLI tests in parallel groups (faster):
```bash
pnpm test:web-cli:parallel              # All groups
pnpm test:web-cli:parallel:auth         # Auth tests only
pnpm test:web-cli:parallel:session      # Session tests only
pnpm test:web-cli:parallel:ui           # UI tests only
```

### Running Specific Test Files

To run a specific test file, use the base `test:mocha` command:
```bash
pnpm test:mocha test/unit/commands/channels/list.test.ts
```

To run specific tests with additional mocha options:
```bash
pnpm test:mocha test/unit/**/*.test.ts --grep "should publish"
```

### Debug Mode

For detailed test output and debugging:
```bash
E2E_DEBUG=true ABLY_CLI_TEST_SHOW_OUTPUT=true pnpm test:e2e
```
