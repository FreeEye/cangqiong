// api/proxy.js
// 这是一个运行在 Vercel 边缘节点的 Serverless 函数
export default async function handler (req, res) {
  // 1. 获取前端传来的参数 (比如 ?ac=detail&ids=123)
  const { query } = req

  // 2. 定义真实的目标接口基础地址
  // 注意：这里已经填好了你要用的那个采集站地址
  const targetBaseUrl = 'https://cj.rycjapi.com/api.php/provide/vod/'

  // 3. 将参数重新拼接成查询字符串
  const queryString = new URLSearchParams(query).toString()
  const finalUrl = `${targetBaseUrl}?${queryString}`

  try {
    // 4. 在服务端发起请求 (服务端请求是没有跨域限制的)
    const response = await fetch(finalUrl, {
      headers: {
        // 伪装成浏览器，防止对方拦截
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    })

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`)
    }

    const data = await response.json()

    // 5. 设置响应头，允许你的前端访问 (解决 CORS)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate') // 加上缓存，让速度更快

    // 6. 返回数据给前端
    res.status(200).json(data)
  } catch (error) {
    console.error('Proxy Error:', error)
    res.status(500).json({ error: 'Failed to fetch data', details: error.message })
  }
}
