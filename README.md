# README

2024/11/17
  - node 20.17.0
  - (npm 10.8.2)

```
npm install -g hexo
```

```
npm init
npm i -S hexo-generator-json-content
npm install --save @fancyapps/ui
```

```
hexo server
hexo new <article name>
hexo new draft <article name>
hexo new page <article name>
hexo generate
hexo deploy
```

```
git remote add -f git@github.com:tsupox/tsupox-blog.github.io.git
```

```
{% asset_img hoge.jpeg %}
```

日本語のシャギー
``` css
body {
  transform:rotate(0.05deg);  //日本語対策
}
```


<!-- ## history

  - 2024/9/9 hexo version up from v5.0.0 to v7.3.0 -->