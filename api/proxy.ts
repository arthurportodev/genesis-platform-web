import {
  handleApiProxy,
  productionProxyEnvironment,
} from "../src/server/api-proxy";

export default {
  fetch(request: Request): Promise<Response> {
    return handleApiProxy(request, productionProxyEnvironment());
  },
};
