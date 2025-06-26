const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

const target = 'https://testnet-rpc.monad.xyz';

app.use('/', createProxyMiddleware({
  target,
  changeOrigin: true,
  onProxyReq: (proxyReq, req, res) => {
    // The monad RPC needs a content-length header, even for GET requests.
    if (req.body) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
    }
  }
}));

const port = 3001;
app.listen(port, () => {
  console.log(`Proxy server listening on port ${port}`);
});