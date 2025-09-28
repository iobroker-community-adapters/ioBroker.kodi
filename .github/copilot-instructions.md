# ioBroker Adapter Development with GitHub Copilot

**Version:** 0.4.0
**Template Source:** https://github.com/DrozmotiX/ioBroker-Copilot-Instructions

This file contains instructions and best practices for GitHub Copilot when working on ioBroker adapter development.

## Project Context

You are working on an ioBroker adapter. ioBroker is an integration platform for the Internet of Things, focused on building smart home and industrial IoT solutions. Adapters are plugins that connect ioBroker to external systems, devices, or services.

### Adapter-Specific Context

- **Adapter Name**: kodi
- **Primary Function**: Control Kodi/XBMC media center via JSON-RPC API
- **Target System**: Kodi media center (version 19+ recommended for seeking functionality)
- **Communication Protocol**: JSON-RPC API over WebSocket and HTTP
- **Key Dependencies**: 
  - `kodi-ws`: Custom WebSocket client for Kodi communication (forked version)
  - `@iobroker/adapter-core`: ioBroker adapter framework
- **Configuration Requirements**:
  - IP address of Kodi instance
  - JSON-RPC port (default: 9090)
  - Optional web server credentials for additional functionality
- **Main Features**:
  - Media playback control (play, pause, stop, seek)
  - Volume control and muting
  - Playlist management
  - Library browsing (video, audio)
  - System commands (shutdown, reboot, hibernate)
  - Player information and status monitoring
  - Notification display on Kodi

## Testing

### Unit Testing
- Use Jest as the primary testing framework for ioBroker adapters
- Create tests for all adapter main functions and helper methods
- Test error handling scenarios and edge cases
- Mock external API calls and hardware dependencies
- For adapters connecting to APIs/devices not reachable by internet, provide example data files to allow testing of functionality without live connections
- Example test structure:
  ```javascript
  describe('AdapterName', () => {
    let adapter;
    
    beforeEach(() => {
      // Setup test adapter instance
    });
    
    test('should initialize correctly', () => {
      // Test adapter initialization
    });
  });
  ```

### Integration Testing

**IMPORTANT**: Use the official `@iobroker/testing` framework for all integration tests. This is the ONLY correct way to test ioBroker adapters.

**Official Documentation**: https://github.com/ioBroker/testing

#### Framework Structure
Integration tests MUST follow this exact pattern:

```javascript
const path = require('path');
const { tests } = require('@iobroker/testing');

// Define test coordinates or configuration
const TEST_COORDINATES = '52.520008,13.404954'; // Berlin
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Use tests.integration() with defineAdditionalTests
tests.integration(path.join(__dirname, '..'), {
    defineAdditionalTests({ suite }) {
        suite('Test adapter with specific configuration', (getHarness) => {
            let harness;

            before(() => {
                harness = getHarness();
            });

            it('should configure and start adapter', function () {
                return new Promise(async (resolve, reject) => {
                    try {
                        harness = getHarness();
                        
                        // Get adapter object using promisified pattern
                        const obj = await new Promise((res, rej) => {
                            harness.objects.getObject('system.adapter.your-adapter.0', (err, o) => {
                                if (err) return rej(err);
                                res(o);
                            });
                        });
                        
                        if (!obj) {
                            return reject(new Error('Adapter object not found'));
                        }

                        // Configure adapter properties
                        Object.assign(obj.native, {
                            position: TEST_COORDINATES,
                            createCurrently: true,
                            createHourly: true,
                            createDaily: true,
                            // Add other configuration as needed
                        });

                        // Set the updated configuration
                        harness.objects.setObject(obj._id, obj);

                        console.log('✅ Step 1: Configuration written, starting adapter...');
                        
                        // Start adapter and wait
                        await harness.startAdapterAndWait();
                        
                        console.log('✅ Step 2: Adapter started');

                        // Wait for adapter to process data
                        const waitMs = 15000;
                        await wait(waitMs);

                        console.log('🔍 Step 3: Checking states after adapter run...');
                        
                        resolve();
                    } catch (error) {
                        console.error('Test failed:', error.message);
                        reject(error);
                    }
                });
            });
        });
    }
});
```

#### Kodi Adapter Specific Testing Considerations

When testing the Kodi adapter, consider these specific scenarios:
- **Connection Testing**: Mock Kodi WebSocket connections since real Kodi instances may not be available in CI
- **JSON-RPC API Responses**: Create mock responses for common Kodi API calls
- **Error Handling**: Test scenarios like network timeouts, invalid JSON responses, and connection losses
- **State Management**: Verify that player states, volume levels, and playback information are correctly tracked
- **Example Mock Structure**:
  ```javascript
  // Mock Kodi responses for testing
  const mockKodiResponses = {
    'Player.GetActivePlayers': {
      id: 1,
      jsonrpc: '2.0',
      result: [{ playerid: 1, type: 'video' }]
    },
    'Player.GetProperties': {
      id: 1,
      jsonrpc: '2.0',
      result: {
        speed: 1,
        time: { hours: 0, minutes: 45, seconds: 30 },
        totaltime: { hours: 1, minutes: 30, seconds: 0 }
      }
    }
  };
  ```

### Required Test Types

#### 1. Basic Functionality Tests
```javascript
it('should handle basic adapter lifecycle', async function () {
    this.timeout(60000);
    
    const harness = getHarness();
    
    // Start the adapter
    await harness.startAdapterAndWait();
    await harness.waitForAdapterState('yellow', 30000); // Allow startup
    
    // Verify adapter is running
    const isRunning = harness.isAdapterRunning();
    expect(isRunning).to.be.true;
    
    // Check basic states exist
    const connectionState = await harness.states.getStateAsync('kodi.0.info.connection');
    expect(connectionState).to.not.be.null;
});
```

#### 2. Configuration Tests
```javascript
it('should handle configuration correctly', async function () {
    this.timeout(30000);
    
    const harness = getHarness();
    
    // Configure adapter with test settings
    await harness.changeAdapterConfig('kodi', {
        native: {
            ip: '192.168.1.100',
            port: 9090,
            login: '',
            password: ''
        }
    });
    
    await harness.startAdapterAndWait();
    
    // Verify configuration is applied
    const adapterConfig = await harness.getAdapterConfig();
    expect(adapterConfig.native.ip).to.equal('192.168.1.100');
    expect(adapterConfig.native.port).to.equal(9090);
});
```

### Mock Testing for Kodi Integration

Since Kodi instances aren't available in CI environments, implement comprehensive mocking:

```javascript
const mockKodiWs = {
  connect: sinon.stub(),
  send: sinon.stub(),
  on: sinon.stub(),
  close: sinon.stub()
};

// Mock the kodi-ws module
proxyquire('../kodi.js', {
  'kodi-ws': function() {
    return mockKodiWs;
  }
});
```

## ioBroker Development Patterns

### Adapter Structure
```javascript
class YourAdapter extends utils.Adapter {
  constructor(options = {}) {
    super({
      ...options,
      name: 'your-adapter',
    });
    this.on('ready', this.onReady.bind(this));
    this.on('stateChange', this.onStateChange.bind(this));
    this.on('unload', this.onUnload.bind(this));
  }

  async onReady() {
    // Initialize adapter
    this.setState('info.connection', false, true);
  }

  onStateChange(id, state) {
    // Handle state changes
  }

  onUnload(callback) {
    try {
      // Clean up resources
      callback();
    } catch (e) {
      callback();
    }
  }
}
```

### Kodi-Specific Development Patterns

#### Connection Management
```javascript
// Proper connection handling for Kodi WebSocket
async connectToKodi() {
  try {
    if (this.kodiWs) {
      this.kodiWs.close();
    }
    
    this.kodiWs = new KodiWs(this.config.ip, this.config.port);
    
    this.kodiWs.on('connected', () => {
      this.log.info('Connected to Kodi');
      this.setState('info.connection', true, true);
    });
    
    this.kodiWs.on('disconnected', () => {
      this.log.warn('Disconnected from Kodi');
      this.setState('info.connection', false, true);
      this.scheduleReconnect();
    });
    
    this.kodiWs.on('error', (error) => {
      this.log.error(`Kodi connection error: ${error.message}`);
      this.setState('info.connection', false, true);
    });
    
    await this.kodiWs.connect();
    
  } catch (error) {
    this.log.error(`Failed to connect to Kodi: ${error.message}`);
    this.setState('info.connection', false, true);
    throw error;
  }
}
```

#### JSON-RPC Command Handling
```javascript
// Send JSON-RPC commands to Kodi
async sendKodiCommand(method, params = {}) {
  if (!this.kodiWs || !this.kodiWs.connected) {
    throw new Error('Not connected to Kodi');
  }
  
  try {
    const result = await this.kodiWs.send({
      jsonrpc: '2.0',
      method: method,
      params: params,
      id: Date.now()
    });
    
    return result;
  } catch (error) {
    this.log.error(`Kodi command failed [${method}]: ${error.message}`);
    throw error;
  }
}
```

#### State Management for Media Players
```javascript
// Update player states based on Kodi notifications
async updatePlayerState(playerId) {
  try {
    const properties = await this.sendKodiCommand('Player.GetProperties', {
      playerid: playerId,
      properties: ['speed', 'time', 'totaltime', 'percentage', 'repeat', 'shuffled']
    });
    
    if (properties) {
      await this.setStateAsync(`Player.${playerId}.speed`, properties.speed || 0, true);
      await this.setStateAsync(`Player.${playerId}.time`, this.formatTime(properties.time), true);
      await this.setStateAsync(`Player.${playerId}.totaltime`, this.formatTime(properties.totaltime), true);
      await this.setStateAsync(`Player.${playerId}.percentage`, properties.percentage || 0, true);
      await this.setStateAsync(`Player.${playerId}.repeat`, properties.repeat || 'off', true);
      await this.setStateAsync(`Player.${playerId}.shuffled`, properties.shuffled || false, true);
    }
  } catch (error) {
    this.log.error(`Failed to update player state: ${error.message}`);
  }
}

// Helper function to format time objects from Kodi
formatTime(timeObj) {
  if (!timeObj || typeof timeObj !== 'object') return '00:00:00';
  
  const hours = String(timeObj.hours || 0).padStart(2, '0');
  const minutes = String(timeObj.minutes || 0).padStart(2, '0');
  const seconds = String(timeObj.seconds || 0).padStart(2, '0');
  
  return `${hours}:${minutes}:${seconds}`;
}
```

### State Management
```javascript
// Create states for ioBroker
await this.setObjectNotExistsAsync('info.connection', {
  type: 'state',
  common: {
    name: 'Connection status',
    type: 'boolean',
    role: 'indicator.connected',
    read: true,
    write: false,
  },
  native: {},
});
```

### Error Handling
```javascript
// Proper error handling with logging
try {
  await this.doSomething();
} catch (error) {
  this.log.error(`Operation failed: ${error.message}`);
  this.setState('info.connection', false, true);
}
```

### Logging Best Practices
Use appropriate log levels for the Kodi adapter:
- `this.log.error()` - Connection failures, API errors, critical issues
- `this.log.warn()` - Connection timeouts, recoverable errors, deprecated features
- `this.log.info()` - Connection status changes, successful operations, configuration changes
- `this.log.debug()` - JSON-RPC message details, state updates, detailed flow information

### Resource Cleanup
```javascript
onUnload(callback) {
  try {
    // Clean up timers
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = undefined;
    }
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = undefined;
    }
    
    // Close Kodi WebSocket connection
    if (this.kodiWs) {
      this.kodiWs.close();
      this.kodiWs = undefined;
    }
    
    // Close connections, clean up resources
    callback();
  } catch (e) {
    callback();
  }
}
```

## Code Style and Standards

- Follow JavaScript/TypeScript best practices
- Use async/await for asynchronous operations
- Implement proper resource cleanup in `unload()` method
- Use semantic versioning for adapter releases
- Include proper JSDoc comments for public methods

### Kodi Adapter Specific Standards
- Always validate JSON-RPC responses before processing
- Implement reconnection logic with exponential backoff
- Handle UTF-8 encoding issues that may occur with Kodi data
- Use consistent naming for Kodi API method mappings
- Implement proper error codes for different failure scenarios

## CI/CD and Testing Integration

### GitHub Actions for API Testing
For adapters with external API dependencies, implement separate CI/CD jobs:

```yaml
# Tests API connectivity with demo credentials (runs separately)
demo-api-tests:
  if: contains(github.event.head_commit.message, '[skip ci]') == false
  
  runs-on: ubuntu-22.04
  
  steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Use Node.js 20.x
      uses: actions/setup-node@v4
      with:
        node-version: 20.x
        cache: 'npm'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run demo API tests
      run: npm run test:integration-demo
```

### CI/CD Best Practices
- Run credential tests separately from main test suite
- Use ubuntu-22.04 for consistency
- Don't make credential tests required for deployment
- Provide clear failure messages for API connectivity issues
- Use appropriate timeouts for external API calls (120+ seconds)

### Package.json Script Integration
Add dedicated script for credential testing:
```json
{
  "scripts": {
    "test:integration-demo": "mocha test/integration-demo --exit"
  }
}
```

### Practical Example: Complete API Testing Implementation
Here's a complete example based on lessons learned from the Discovergy adapter:

#### test/integration-demo.js
```javascript
const path = require("path");
const { tests } = require("@iobroker/testing");

// Helper function to encrypt password using ioBroker's encryption method
async function encryptPassword(harness, password) {
    const systemConfig = await harness.objects.getObjectAsync("system.config");
    
    if (!systemConfig || !systemConfig.native || !systemConfig.native.secret) {
        throw new Error("Could not retrieve system secret for password encryption");
    }
    
    const secret = systemConfig.native.secret;
    let result = '';
    for (let i = 0; i < password.length; ++i) {
        result += String.fromCharCode(secret[i % secret.length].charCodeAt(0) ^ password.charCodeAt(i));
    }
    
    return result;
}

// Run integration tests with demo credentials
tests.integration(path.join(__dirname, ".."), {
    defineAdditionalTests({ suite }) {
        suite("API Testing with Demo Credentials", (getHarness) => {
            let harness;
            
            before(() => {
                harness = getHarness();
            });

            it("Should connect to API and initialize with demo credentials", async () => {
                console.log("Setting up demo credentials...");
                
                if (harness.isAdapterRunning()) {
                    await harness.stopAdapter();
                }
                
                const encryptedPassword = await encryptPassword(harness, "demo_password");
                
                await harness.changeAdapterConfig("your-adapter", {
                    native: {
                        username: "demo@provider.com",
                        password: encryptedPassword,
                        // other config options
                    }
                });

                console.log("Starting adapter with demo credentials...");
                await harness.startAdapter();
                
                // Wait for API calls and initialization
                await new Promise(resolve => setTimeout(resolve, 60000));
                
                const connectionState = await harness.states.getStateAsync("your-adapter.0.info.connection");
                
                if (connectionState && connectionState.val === true) {
                    console.log("✅ SUCCESS: API connection established");
                    return true;
                } else {
                    throw new Error("API Test Failed: Expected API connection to be established with demo credentials. " +
                        "Check logs above for specific API errors (DNS resolution, 401 Unauthorized, network issues, etc.)");
                }
            }).timeout(120000);
        });
    }
});
```

### Kodi Adapter CI/CD Considerations

Since the Kodi adapter requires a running Kodi instance, testing strategies should include:

1. **Mock-based testing** for CI environments (primary approach)
2. **Docker-based Kodi testing** (optional, for more comprehensive testing)
3. **Manual testing guidelines** for developers

#### Example Mock-based CI Test
```javascript
// test/integration-mock.js - Testing without real Kodi instance
const path = require("path");
const { tests } = require("@iobroker/testing");
const sinon = require('sinon');

tests.integration(path.join(__dirname, ".."), {
    defineAdditionalTests({ suite }) {
        suite("Kodi Adapter Mock Testing", (getHarness) => {
            let harness;
            
            before(() => {
                harness = getHarness();
            });

            it("Should handle mock Kodi responses correctly", async () => {
                console.log("Setting up mock Kodi configuration...");
                
                await harness.changeAdapterConfig("kodi", {
                    native: {
                        ip: "127.0.0.1",
                        port: 9090,
                        login: "",
                        password: ""
                    }
                });

                console.log("Starting adapter with mock configuration...");
                await harness.startAdapter();
                
                // Wait for adapter initialization
                await new Promise(resolve => setTimeout(resolve, 10000));
                
                // Verify adapter created expected states
                const connectionState = await harness.states.getStateAsync("kodi.0.info.connection");
                expect(connectionState).to.not.be.null;
                
                console.log("✅ SUCCESS: Mock testing completed");
                return true;
            }).timeout(30000);
        });
    }
});
```