# 九星级字词闯关

一个适合小学生在手机上练习中文词语的静态网页小游戏，词库来自《九星级（带拼音）》PDF，共 202 个词。

## 功能

- 听音选词：听到读音后选择正确词语，答对自动进入下一题。
- 词卡复习：显示词语和拼音，点“认识了”自动进入下一张卡片。
- 朗读设置：可以手动选择普通话或粤语朗读，适配 iPhone 浏览器。
- 本地进度：得分、连对、已练词语会保存在当前浏览器里。

## 本地预览

```bash
python3 -m http.server 8000
```

然后打开：

```text
http://localhost:8000
```

## 发布到 GitHub Pages

1. 在 GitHub 新建一个公开仓库，例如 `hanzi-quest`。
2. 把本文件夹里的所有文件推送到仓库的 `main` 分支。
3. 进入仓库 `Settings` -> `Pages`。
4. Source 选择 `Deploy from a branch`。
5. Branch 选择 `main`，文件夹选择 `/root`，保存。

发布完成后，访问地址通常是：

```text
https://你的GitHub用户名.github.io/hanzi-quest/
```

## 文件说明

- `index.html`：网页结构。
- `styles.css`：页面样式。
- `script.js`：游戏逻辑。
- `words.js`：词语和拼音数据。
