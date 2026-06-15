const https = require('https');

function testProxy(sourceName, apiUrl) {
  return new Promise((resolve) => {
    const url = 'https://api.allorigins.win/get?url=' + encodeURIComponent(apiUrl);
    
    const req = https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const outer = JSON.parse(data);
          const contents = outer.contents;
          if (typeof contents === 'string') {
            const inner = JSON.parse(contents);
            resolve({
              source: sourceName,
              success: true,
              code: inner.code,
              listLength: inner.list?.length || 0,
              firstVideo: inner.list && inner.list[0] ? inner.list[0].vod_name + ' | ' + inner.list[0].type_name : null
            });
          } else {
            resolve({ source: sourceName, success: false, error: 'contents is not string' });
          }
        } catch (e) {
          resolve({ source: sourceName, success: false, error: e.message });
        }
      });
    });
    req.on('error', (e) => resolve({ source: sourceName, success: false, error: e.message }));
    req.setTimeout(15000, () => { req.destroy(); resolve({ source: sourceName, success: false, error: 'timeout' }); });
  });
}

(async () => {
  const sources = [
    ['如意资源', 'https://cj.rycjapi.com/api.php/provide/vod/?ac=detail'],
    ['极速资源', 'https://jszyapi.com/api.php/provide/vod/?ac=detail'],
    ['最大资源', 'https://api.zuidapi.com/api.php/provide/vod/?ac=detail'],
    ['无尽资源', 'https://api.wujinapi.me/api.php/provide/vod/?ac=detail'],
  ];

  console.log('测试 allorigins-get 代理 + 各视频源...\n');
  
  for (const [name, url] of sources) {
    const result = await testProxy(name, url);
    if (result.success) {
      console.log(`✅ ${result.source}: code=${result.code}, list=${result.listLength}, first=${result.firstVideo}`);
    } else {
      console.log(`❌ ${result.source}: ${result.error}`);
    }
  }
  console.log('\n测试完成！');
})();
