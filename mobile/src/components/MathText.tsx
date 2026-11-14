import React, { useMemo, useState } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors } from '../theme';

interface Props {
  text: string;
  style?: ViewStyle;
  fontSize?: number;
}

/** Reports the rendered content height back to RN so the WebView auto-sizes. */
const RESIZE_SCRIPT = `
  const post = () => window.ReactNativeWebView &&
    window.ReactNativeWebView.postMessage(String(Math.ceil(document.documentElement.scrollHeight || document.body.scrollHeight)));
  new MutationObserver(post).observe(document.body, { childList: true, subtree: true, characterData: true });
  post(); setTimeout(post, 200); setTimeout(post, 600); setTimeout(post, 1200); setTimeout(post, 2500);
  true;
`;

/**
 * Renders mixed Arabic/Latin text with LaTeX math ($...$, $$...$$, \(...\))
 * via KaTeX inside a lightweight, auto-height WebView. Falls back to plain
 * text styling when the content has no math markers.
 */
export function MathText({ text, style, fontSize = 15 }: Props) {
  const [height, setHeight] = useState(56);
  const html = useMemo(() => {
    const escaped = (text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>');
    return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"/>
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"></script>
<style>
  body { margin:0; padding:2px; font-size:${fontSize}px; line-height:1.7; color:${colors.text};
    font-family: system-ui, 'Segoe UI', Tahoma, sans-serif; direction: rtl; text-align: right;
    overflow-wrap: break-word; word-break: break-word; }
  .katex { font-size: 1.05em; }
</style></head>
<body>${escaped}
<script>
  if (window.renderMathInElement) renderMathInElement(document.body, {
    delimiters: [
      {left:'$$', right:'$$', display:true},
      {left:'\\\\(', right:'\\\\)', display:false},
      {left:'$', right:'$', display:false}
    ], throwOnError: false
  });
</script></body></html>`;
  }, [text, fontSize]);

  return (
    <View style={[styles.wrap, style]}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={{ height }}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        androidLayerType="software"
        textInteractionEnabled={false}
        injectedJavaScript={RESIZE_SCRIPT}
        onMessage={(e) => {
          const h = Number(e.nativeEvent.data);
          if (h > 30 && h < 4000) setHeight(h + 8);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { minHeight: 40 },
});
