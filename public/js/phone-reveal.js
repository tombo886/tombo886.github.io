/* ==========================================================================
   电话/微信号码点击显示
   号码不能以明文出现在 HTML/JS 源码里，连注释里也不行——写死一个
   <a href="tel:..."> 或者在注释里提一句真实号码，都等于把号码原样交给
   任何读源码的爬虫，"点击显示"就只是骗肉眼。现在号码只存在后端的
   环境变量里（见 server.js），源码里一位都没有；点击时才 POST
   /api/contact/phone 取回来，换成真正的 tel: 链接。

   按钮本身也是这个文件动态插入的，不是写死在 HTML 里——JS 关掉时
   .contact-bar__phone 这个槽位保持空，不留一个点了没反应的死按钮。

   按钮文案用英文（"Show phone / WeChat"），不是"点击显示电话 / 微信"——
   这是踩过坑之后改的：这行字是按钮上活生生要给人看的字（不是隐藏文字），
   只要真的渲染出中文，浏览器就得用中文字体去排版它，@font-face 的
   unicode-range 一看到中文字符就会把 HarmonyOS 的 .ttf 拉下来——跟这
   一整版改用 SVG 标题、就是为了不下载这几个 8MB 字体文件的目标直接
   冲突。改成英文后，页面上唯一真正需要中文的地方（"个人作品集"）全程
   只存在于 SVG 路径和 aria-label 属性值里，两者都不参与字体排版，
   Network 面板才能做到真正零 .ttf 请求。

   无障碍：读屏器怎么知道号码出现了，有两种常见做法——给结果区域套
   aria-live="polite"，或者把焦点移到新出现的链接上。这里选的是移动
   焦点：用户本来就在按钮上（键盘 Tab 或点击都成立），点击后焦点跟着
   内容一起移动到新链接，读屏器会照常播报新聚焦元素的角色和文字，不用
   依赖 aria-live 的播报时机（不同读屏器对 aria-live 更新的反应速度不
   一致，移动焦点更可控）。
   ========================================================================== */

async function initPhoneReveal() {
  const slot = document.querySelector('[data-phone-slot]');
  if (!slot) return;

  // 后端没配号码（或者根本没有后端，比如被当成纯静态页打开）时不渲染按钮，
  // 跟"关掉 JS 时这一格保持空"是同一个原则：不留一个点了没反应的死按钮。
  try {
    const res = await fetch('/api/contact');
    if (!res.ok || !(await res.json()).phoneAvailable) return;
  } catch {
    return;
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'contact-bar__reveal';
  button.textContent = 'Show phone / WeChat';

  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      const res = await fetch('/api/contact/phone', { method: 'POST' });
      if (!res.ok) throw new Error(res.status);
      const { number, tel } = await res.json();
      const link = document.createElement('a');
      link.href = 'tel:' + tel;
      link.className = 'contact-bar__phone-link';
      link.textContent = number;
      slot.replaceChildren(link);
      link.focus();
    } catch {
      button.disabled = false;
      button.textContent = 'Try again';
    }
  });

  slot.appendChild(button);
}

initPhoneReveal();
