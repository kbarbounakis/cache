// eslint-disable-next-line no-undef
jest.setTimeout(30000);
const { TraceUtils } = require('@themost/common');
const {JsonLogger} = require('@themost/json-logger');
process.env.NODE_ENV = 'development';
TraceUtils.useLogger(new JsonLogger({
   format: 'raw'
}));
