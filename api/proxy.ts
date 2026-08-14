import {
  handleApiProxy,
  productionProxyEnvironment,
} from "../src/server/api-proxy.js";

export default {
  fetch(request: Request): Promise<Response> {
    return handleApiProxy(request, productionProxyEnvironment());
  },
};
