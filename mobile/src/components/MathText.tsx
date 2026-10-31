import React, { useMemo } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors } from '../theme';

interface Props {
  text: string;
  style?: ViewStyle;
  fontSize?: number;
}

/**
 * Renders mixed Arabic/Latin text with LaTeX math ($...$, $$...$$, \(...\))
 * via KaTeX inside a lightweight WebView. Falls back to plain text styling
 * when the content has no math markers.
 */
export function MathText({ text, style, fontSize = 15 }: Props) {
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
  body { margin:0; padding:2px; font-size:${fontSize}px; color:${colors.text};
    font-family: system-ui, 'Segoe UI', Tahoma, sans-serif; direction: rtl; text-align: right; }
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
        style={styles.webview}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        androidLayerType="software"
        textInteractionEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { minHeight: 40 },
  webview: { flex: 1, backgroundColor: 'transparent' },
});
