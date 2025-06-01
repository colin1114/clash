// UTF-8安全的Base64编码函数
function utf8ToBase64(str) {
  // 将字符串转换为UTF-8字节，然后进行Base64编码
  const encoder = new TextEncoder()
  const data = encoder.encode(str)
  const binString = Array.from(data, (byte) => String.fromCharCode(byte)).join('')
  return btoa(binString)
}

// UTF-8安全的Base64解码函数
function base64ToUtf8(base64) {
  // Base64解码，然后转换为UTF-8字符串
  const binString = atob(base64)
  const bytes = new Uint8Array(binString.length)
  for (let i = 0; i < binString.length; i++) {
    bytes[i] = binString.charCodeAt(i)
  }
  const decoder = new TextDecoder()
  return decoder.decode(bytes)
}

// 生成短ID的函数
function generateShortId() {
  // 生成6位随机字符串，包含字母和数字
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 存储配置内容的对象 (内存缓存)
const configCache = {};

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  
  // 处理CORS
  if (request.method === 'OPTIONS') {
    return new Response('OK', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    })
  }
  
  // 如果是GET请求，返回HTML页面
  if (request.method === 'GET' && url.pathname === '/') {
    return new Response(HTML_CONTENT, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
  
  // 处理短链接
  if (request.method === 'GET' && url.pathname.match(/^\/c\/[A-Za-z0-9]{6}$/)) {
    const shortId = url.pathname.split('/c/')[1]
    
    // 从缓存中获取配置
    const yamlContent = configCache[shortId]
    
    if (!yamlContent) {
      return new Response('配置未找到或已过期', { 
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      })
    }
    
    // 检查是否请求下载
    const downloadParam = url.searchParams.get('download')
    const isDownload = downloadParam === 'true' || request.headers.get('user-agent')?.includes('clash')
    
    const headers = {
      'Content-Type': 'text/yaml; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Profile-Update-Interval': '24'
    }
    
    // 如果是下载请求或Clash客户端访问，添加Content-Disposition头
    if (isDownload) {
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')
      headers['Content-Disposition'] = `attachment; filename="clash-config-${timestamp}.yaml"`
    }
    
    return new Response(yamlContent, { headers })
  }
  
  // 处理配置文件下载
  if (request.method === 'GET' && url.pathname.startsWith('/clash/')) {
    try {
      // 从URL路径中提取配置数据
      const configId = url.pathname.split('/clash/')[1]
      if (!configId) {
        return new Response('配置ID无效', { 
          status: 400,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        })
      }
      
      // 解码配置内容
      const yamlContent = base64ToUtf8(decodeURIComponent(configId))
      
      // 检查是否请求下载
      const downloadParam = url.searchParams.get('download')
      const isDownload = downloadParam === 'true' || request.headers.get('user-agent')?.includes('clash')
      
      const headers = {
        'Content-Type': 'text/yaml; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Profile-Update-Interval': '24'
      }
      
      // 如果是下载请求或Clash客户端访问，添加Content-Disposition头
      if (isDownload) {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')
        headers['Content-Disposition'] = `attachment; filename="clash-config-${timestamp}.yaml"`
      }
      
      return new Response(yamlContent, { headers })
    } catch (error) {
      return new Response('配置解析失败: ' + error.message, { 
        status: 400,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      })
    }
  }
  
  // 添加简化的YAML访问路由 /yaml/{config-id}
  if (request.method === 'GET' && url.pathname.startsWith('/yaml/')) {
    try {
      const configId = url.pathname.split('/yaml/')[1]
      if (!configId) {
        return new Response('配置ID无效', { 
          status: 400,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        })
      }
      
      // 解码配置内容
      const yamlContent = base64ToUtf8(decodeURIComponent(configId))
      
      return new Response(yamlContent, {
        headers: {
          'Content-Type': 'text/yaml; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Profile-Update-Interval': '24',
          'Content-Disposition': 'attachment; filename="clash-config.yaml"'
        }
      })
    } catch (error) {
      return new Response('配置解析失败: ' + error.message, { 
        status: 400,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      })
    }
  }
  
  // 处理订阅转换
  if (request.method === 'POST' && url.pathname === '/convert') {
    try {
      const { subscriptionUrl, configName } = await request.json()
      
      if (!subscriptionUrl) {
        return new Response(JSON.stringify({ error: '请提供订阅链接或代理链接' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        })
      }
      
      // 分割多行输入
      const subscriptionUrls = subscriptionUrl
        .split(/[\n\r]+/)  // 同时处理 \n 和 \r\n
        .map(url => url.trim())
        .filter(url => url);  // 过滤空行
      let allServers = []
      
      // 处理每一行输入
      for (const subUrl of subscriptionUrls) {
        // 跳过空行
        if (!subUrl.trim()) continue
        
        let subscriptionData = ''
        
        // 判断输入类型：是URL还是直接的代理链接
        if (subUrl.startsWith('http://') || subUrl.startsWith('https://')) {
          // 是订阅链接URL，需要fetch获取内容
          try {
            const response = await fetch(subUrl.trim())
            subscriptionData = await response.text()
          } catch (fetchError) {
            console.error('获取订阅内容失败:', fetchError.message, '订阅链接:', subUrl)
            // 继续处理其他链接，不中断整个流程
            continue
          }
        } else if (subUrl.includes('://')) {
          // 直接是代理链接内容（包含协议前缀）
          subscriptionData = subUrl
        } else {
          // 可能是Base64编码的内容
          subscriptionData = subUrl
        }
        
        // 智能处理订阅格式
        let servers = []
        
        // 尝试判断是否为Base64编码的订阅
        try {
          // 检查是否是Base64编码（没有协议前缀的情况）
          if (!subscriptionData.includes('://') && subscriptionData.length > 20) {
            // 尝试使用标准atob，如果失败则使用UTF-8安全解码
            let decodedData
            try {
              decodedData = atob(subscriptionData.trim())
            } catch (e) {
              decodedData = base64ToUtf8(subscriptionData.trim())
            }
            servers = decodedData.split('\n').filter(line => line.trim())
          } else {
            // 直接是多行代理链接格式
            servers = subscriptionData.split('\n').filter(line => line.trim())
          }
        } catch (e) {
          // Base64解码失败，按普通文本处理
          servers = subscriptionData.split('\n').filter(line => line.trim())
        }
        
        // 将此行的服务器添加到总列表
        allServers = [...allServers, ...servers]
      }
      
      // 确保至少有一个节点
      if (allServers.length === 0) {
        return new Response(JSON.stringify({ 
          error: '未找到有效的代理节点，请检查订阅链接是否正确' 
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        })
      }
      
      // 转换为Clash配置
      const clashConfig = await convertToClash(allServers, configName || 'My Clash Config')
      const yamlContent = generateClashYAML(clashConfig)
      
      // 生成短链接
      const shortId = generateShortId()
      // 存储到内存缓存
      configCache[shortId] = yamlContent
      
      // 生成订阅链接
      const shortSubscriptionLink = `${url.origin}/c/${shortId}`
      
      // 同时保留原有的长链接，以保持向后兼容
      const encodedConfig = encodeURIComponent(utf8ToBase64(yamlContent))
      const subscriptionLink = `${url.origin}/clash/${encodedConfig}`
      const yamlDownloadLink = `${url.origin}/yaml/${encodedConfig}`
      
      return new Response(JSON.stringify({ 
        success: true, 
        config: clashConfig,
        yaml: yamlContent,
        subscriptionUrl: shortSubscriptionLink, // 使用短链接
        shortUrl: shortSubscriptionLink,
        longUrl: subscriptionLink,
        yamlUrl: yamlDownloadLink,
        downloadUrl: `${shortSubscriptionLink}?download=true`,
        message: '配置转换成功！可以直接使用订阅链接导入Clash客户端'
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
      
    } catch (error) {
      return new Response(JSON.stringify({ 
        error: '转换失败: ' + error.message 
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }
  }
  
  return new Response('Not Found', { status: 404 })
}

async function convertToClash(servers, configName) {
  const proxies = []
  const proxyNames = []
  
  for (const server of servers) {
    if (!server.trim()) continue
    
    try {
      let proxy = null
      
      if (server.startsWith('vmess://')) {
        proxy = parseVmess(server)
      } else if (server.startsWith('ss://')) {
        proxy = parseShadowsocks(server)
      } else if (server.startsWith('trojan://')) {
        proxy = parseTrojan(server)
      } else if (server.startsWith('vless://')) {
        proxy = parseVless(server)
      } else {
        console.log('未识别的协议:', server.substring(0, 50) + '...')
        continue
      }
      
      if (proxy && proxy.name && proxy.server) {
        proxies.push(proxy)
        proxyNames.push(proxy.name)
        console.log('成功解析节点:', proxy.name)
      } else {
        console.log('节点解析失败:', server.substring(0, 50) + '...')
      }
    } catch (e) {
      console.error('解析服务器失败:', e.message, 'URL:', server.substring(0, 50) + '...')
    }
  }
  
  if (proxies.length === 0) {
    throw new Error('没有成功解析到任何有效的代理节点，请检查订阅链接格式')
  }
  
  return {
    name: configName,
    proxies: proxies,
    'proxy-groups': [
      {
        name: '🚀 节点选择',
        type: 'select',
        proxies: ['♻️ 自动选择', '🎯 全球直连', ...proxyNames]
      },
      {
        name: '♻️ 自动选择',
        type: 'url-test',
        proxies: proxyNames,
        url: 'http://www.gstatic.com/generate_204',
        interval: 300
      },
      {
        name: '🎯 全球直连',
        type: 'select',
        proxies: ['DIRECT']
      }
    ],
    rules: [
      'DOMAIN-SUFFIX,local,DIRECT',
      'IP-CIDR,127.0.0.0/8,DIRECT',
      'IP-CIDR,172.16.0.0/12,DIRECT',
      'IP-CIDR,192.168.0.0/16,DIRECT',
      'IP-CIDR,10.0.0.0/8,DIRECT',
      'GEOIP,CN,🎯 全球直连',
      'MATCH,🚀 节点选择'
    ]
  }
}

function parseVmess(vmessUrl) {
  try {
    const vmessDataStr = vmessUrl.slice(8) // 移除 "vmess://" 前缀
    // 尝试使用标准atob，如果失败则使用UTF-8安全解码
    let jsonStr
    try {
      jsonStr = atob(vmessDataStr)
    } catch (e) {
      jsonStr = base64ToUtf8(vmessDataStr)
    }
    
    const vmessData = JSON.parse(jsonStr)
    return {
      name: vmessData.ps || `${vmessData.add}:${vmessData.port}`,
      type: 'vmess',
      server: vmessData.add,
      port: parseInt(vmessData.port),
      uuid: vmessData.id,
      alterId: parseInt(vmessData.aid || 0),
      cipher: 'auto',
      network: vmessData.net || 'tcp',
      tls: vmessData.tls === 'tls',
      ...(vmessData.path && { 'ws-opts': { path: vmessData.path } }),
      ...(vmessData.host && { 'ws-opts': { ...vmessData['ws-opts'], headers: { Host: vmessData.host } } })
    }
  } catch (error) {
    console.error('解析VMess链接失败:', error)
    return null
  }
}

function parseShadowsocks(ssUrl) {
  try {
    const url = new URL(ssUrl)
    let method, password
    
    // 处理Base64编码的用户信息
    try {
      // 尝试使用标准atob，如果失败则使用UTF-8安全解码
      let userinfo
      try {
        userinfo = atob(url.username)
      } catch (e) {
        userinfo = base64ToUtf8(url.username)
      }
      
      if (userinfo.includes(':')) {
        [method, password] = userinfo.split(':')
      } else {
        // 某些格式可能只有password，method在其他地方
        method = 'aes-256-gcm' // 默认加密方法
        password = userinfo
      }
    } catch (e) {
      // 如果Base64解码失败，尝试直接使用
      if (url.username.includes(':')) {
        [method, password] = url.username.split(':')
      } else {
        method = 'aes-256-gcm'
        password = url.username
      }
    }
    
    // 获取节点名称，处理URL编码
    let nodeName = ''
    if (url.hash) {
      try {
        nodeName = decodeURIComponent(url.hash.slice(1))
      } catch (e) {
        nodeName = url.hash.slice(1)
      }
    }
    
    return {
      name: nodeName || `${url.hostname}:${url.port}`,
      type: 'ss',
      server: url.hostname,
      port: parseInt(url.port),
      cipher: method,
      password: password
    }
  } catch (error) {
    console.error('解析Shadowsocks链接失败:', error)
    return null
  }
}

function parseTrojan(trojanUrl) {
  const url = new URL(trojanUrl)
  return {
    name: decodeURIComponent(url.hash.slice(1)) || `${url.hostname}:${url.port}`,
    type: 'trojan',
    server: url.hostname,
    port: parseInt(url.port),
    password: url.username,
    sni: url.searchParams.get('sni') || url.hostname
  }
}

function parseVless(vlessUrl) {
  try {
    const url = new URL(vlessUrl)
    const params = url.searchParams
    
    // 解析基本参数
    const server = url.hostname
    const port = parseInt(url.port)
    const uuid = url.username
    
    // 解析VLESS特有参数
    const encryption = params.get('encryption') || 'none'
    const type = params.get('type') || 'tcp'
    const security = params.get('security') || 'none'
    
    // 构建Clash配置
    const vlessConfig = {
      name: decodeURIComponent(url.hash.slice(1)) || `${server}:${port}`,
      type: 'vless',
      server: server,
      port: port,
      uuid: uuid,
      network: type,
      tls: security === 'tls' || security === 'reality',
      udp: true
    }
    
    // 添加TLS相关参数
    if (vlessConfig.tls) {
      vlessConfig['skip-cert-verify'] = true
      vlessConfig.servername = params.get('sni') || server
    }
    
    // 添加Reality相关参数
    if (security === 'reality') {
      vlessConfig.reality = true
      vlessConfig['reality-opts'] = {
        'public-key': params.get('pbk') || '',
        'short-id': params.get('sid') || ''
      }
      if (params.get('fp')) {
        vlessConfig.fingerprint = params.get('fp')
      }
    }
    
    // 添加传输方式特有参数
    if (type === 'ws') {
      vlessConfig['ws-opts'] = {
        path: params.get('path') || '/',
        headers: {}
      }
      if (params.get('host')) {
        vlessConfig['ws-opts'].headers.Host = params.get('host')
      }
    } else if (type === 'grpc') {
      vlessConfig['grpc-opts'] = {
        'grpc-service-name': params.get('serviceName') || ''
      }
    } else if (type === 'h2') {
      vlessConfig['h2-opts'] = {
        host: [params.get('host') || server],
        path: params.get('path') || '/'
      }
    }
    
    return vlessConfig
  } catch (error) {
    console.error('解析VLESS链接失败:', error)
    return null
  }
}

function generateClashYAML(config) {
  const yaml = `# Clash 配置文件
# 配置名称: ${config.name}
# 生成时间: ${new Date().toISOString()}

port: 7890
socks-port: 7891
allow-lan: true
mode: rule
log-level: info
external-controller: 127.0.0.1:9090

dns:
  enable: true
  listen: 0.0.0.0:53
  enhanced-mode: fake-ip
  nameserver:
    - 223.5.5.5
    - 119.29.29.29
    - 8.8.8.8
  fallback:
    - 8.8.8.8
    - 1.1.1.1

proxies:
${config.proxies.map(proxy => '  - ' + JSON.stringify(proxy, null, 2).split('\n').join('\n    ')).join('\n')}

proxy-groups:
${config['proxy-groups'].map(group => '  - ' + JSON.stringify(group, null, 2).split('\n').join('\n    ')).join('\n')}

rules:
${config.rules.map(rule => '  - ' + rule).join('\n')}
`
  return yaml
}

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Clash 订阅转换器</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; color: #333; }
        .container { max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 40px; padding: 40px 0; }
        .header h1 { color: white; font-size: 2.5rem; margin-bottom: 10px; text-shadow: 0 2px 4px rgba(0,0,0,0.3); }
        .header p { color: rgba(255,255,255,0.9); font-size: 1.1rem; }
        .card { background: white; border-radius: 20px; padding: 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); margin-bottom: 20px; }
        .form-group { margin-bottom: 25px; }
        .form-group label { display: block; font-weight: 600; margin-bottom: 8px; color: #555; }
        .form-control { width: 100%; padding: 12px 16px; border: 2px solid #e1e5e9; border-radius: 10px; font-size: 16px; transition: all 0.3s ease; }
        .form-control:focus { outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1); }
        textarea.form-control { min-height: 120px; resize: vertical; }
        .btn { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 12px 30px; border-radius: 25px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.3s ease; text-decoration: none; display: inline-block; }
        .btn:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4); }
        .btn-block { width: 100%; text-align: center; }
        .result { margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 10px; border-left: 4px solid #667eea; }
        .copy-btn { background: #28a745; margin-top: 10px; }
        .copy-btn:hover { background: #218838; }
        .error { background: #f8d7da; color: #721c24; border-left-color: #dc3545; }
        .success { background: #d4edda; color: #155724; border-left-color: #28a745; }
        .info-box { background: #e3f2fd; padding: 15px; border-radius: 10px; margin-bottom: 20px; border-left: 4px solid #2196f3; }
        .info-box h3 { color: #1976d2; margin-bottom: 10px; }
        .info-box ul { padding-left: 20px; }
        .info-box li { margin-bottom: 5px; color: #333; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Clash 订阅转换器</h1>
            <p>轻松将各种订阅链接转换为 Clash 配置文件</p>
        </div>
        <div class="card">
            <div class="info-box">
                <h3>📋 支持的订阅类型</h3>
                <ul>
                    <li>V2Ray 订阅链接</li>
                    <li>VLESS 订阅链接</li>
                    <li>Shadowsocks 订阅链接</li>
                    <li>Trojan 订阅链接</li>
                    <li>Mixed 混合订阅</li>
                </ul>
            </div>
            <form id="convertForm">
                <div class="form-group">
                    <label for="subscriptionUrl">订阅链接</label>
                    <textarea class="form-control" id="subscriptionUrl" rows="6" placeholder="请输入您的订阅链接，支持多行输入，每行一个链接"></textarea>
                </div>
                <div class="form-group">
                    <label for="configName">配置名称（可选）</label>
                    <input type="text" class="form-control" id="configName" placeholder="我的 Clash 配置" value="My Clash Config">
                </div>
                <button type="submit" class="btn btn-block">🔄 转换订阅</button>
            </form>
            <div id="result" style="display: none;"></div>
        </div>
    </div>
    <script>
        document.getElementById('convertForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const subscriptionUrl = document.getElementById('subscriptionUrl').value;
            const configName = document.getElementById('configName').value;
            
            if (!subscriptionUrl) {
                showResult('❌ 请输入订阅链接', 'error');
                return;
            }
            
            showResult('🔄 正在转换订阅...', 'result');
            
            try {
                const response = await fetch('/convert', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ subscriptionUrl, configName })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showResult(\`
                        <h3>✅ 转换成功！</h3>
                        <p>配置名称: \${result.config.name}</p>
                        <p>节点数量: \${result.config.proxies.length}</p>
                        
                        <div style="margin: 15px 0; padding: 10px; background: #f0f8ff; border-radius: 8px; border-left: 4px solid #007bff;">
                            <h4>📎 订阅链接 (可直接导入Clash)：</h4>
                            <input class="form-control" style="margin: 10px 0" value="\${result.subscriptionUrl}" readonly>
                            <button class="btn" style="background: #007bff" onclick="copyToClipboard('\${result.subscriptionUrl}')">📋 复制订阅链接</button>
                        </div>
                        
                        <button class="btn copy-btn" onclick="copyToClipboard(\\\`\${result.yaml}\\\`)">📋 复制 YAML 配置</button>
                        <textarea class="form-control" style="margin-top: 10px;" readonly>\${result.yaml}</textarea>
                    \`, 'success');
                } else {
                    showResult('❌ ' + result.error, 'error');
                }
            } catch (error) {
                showResult('❌ 网络错误: ' + error.message, 'error');
            }
        });
        
        function showResult(content, type = 'result') {
            const resultDiv = document.getElementById('result');
            resultDiv.innerHTML = content;
            resultDiv.className = \`result \${type}\`;
            resultDiv.style.display = 'block';
        }
        
        function copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(() => {
                showResult('✅ 已复制到剪贴板！', 'success');
            });
        }
    </script>
</body>
</html>`; 