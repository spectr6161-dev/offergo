using System.Diagnostics;
using System.Text;
using System.Text.RegularExpressions;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;

namespace TutorOverlay.Client.Controls;

public sealed class MarkdownTextBlock : TextBlock
{
    public static readonly DependencyProperty MarkdownProperty = DependencyProperty.Register(
        nameof(Markdown),
        typeof(string),
        typeof(MarkdownTextBlock),
        new PropertyMetadata(string.Empty, OnMarkdownChanged));

    private static readonly Regex HeaderRegex = new(@"^(#{1,6})\s+(.*)$", RegexOptions.Compiled);
    private static readonly Regex BulletRegex = new(@"^\s*[-*+]\s+(.*)$", RegexOptions.Compiled);
    private static readonly Regex OrderedListRegex = new(@"^\s*(\d+)\.\s+(.*)$", RegexOptions.Compiled);
    private static readonly Regex QuoteRegex = new(@"^\s*>\s?(.*)$", RegexOptions.Compiled);

    private readonly System.Windows.Media.Brush _mutedBrush;
    private readonly System.Windows.Media.Brush _accentBrush;
    private readonly System.Windows.Media.Brush _codeBackgroundBrush;

    public MarkdownTextBlock()
    {
        TextWrapping = TextWrapping.Wrap;
        LineStackingStrategy = LineStackingStrategy.BlockLineHeight;
        LineHeight = 22;

        _mutedBrush = ResolveBrush("MutedBrush", new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(154, 164, 168)));
        _accentBrush = ResolveBrush("AccentGreenBrush", new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(67, 160, 71)));
        _codeBackgroundBrush = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromArgb(48, 255, 255, 255));
    }

    public string Markdown
    {
        get => (string)GetValue(MarkdownProperty);
        set => SetValue(MarkdownProperty, value);
    }

    private static void OnMarkdownChanged(DependencyObject dependencyObject, DependencyPropertyChangedEventArgs e)
    {
        if (dependencyObject is MarkdownTextBlock control)
        {
            control.RenderMarkdown(e.NewValue as string ?? string.Empty);
        }
    }

    private void RenderMarkdown(string markdown)
    {
        Inlines.Clear();

        if (string.IsNullOrWhiteSpace(markdown))
        {
            return;
        }

        var normalized = markdown.Replace("\r\n", "\n").Replace('\r', '\n').TrimEnd();
        var lines = normalized.Split('\n');
        var codeFenceLines = new List<string>();
        var inCodeFence = false;
        var isFirstBlock = true;
        var addExtraGapBeforeNextBlock = false;

        foreach (var rawLine in lines)
        {
            if (rawLine.TrimStart().StartsWith("```", StringComparison.Ordinal))
            {
                if (inCodeFence)
                {
                    AddBlockSeparator(ref isFirstBlock, addExtraGapBeforeNextBlock);
                    addExtraGapBeforeNextBlock = false;
                    AppendCodeBlock(string.Join("\n", codeFenceLines));
                    codeFenceLines.Clear();
                    inCodeFence = false;
                }
                else
                {
                    inCodeFence = true;
                    codeFenceLines.Clear();
                }

                continue;
            }

            if (inCodeFence)
            {
                codeFenceLines.Add(rawLine);
                continue;
            }

            if (string.IsNullOrWhiteSpace(rawLine))
            {
                addExtraGapBeforeNextBlock = true;
                continue;
            }

            AddBlockSeparator(ref isFirstBlock, addExtraGapBeforeNextBlock);
            addExtraGapBeforeNextBlock = false;
            AppendMarkdownLine(rawLine);
        }

        if (inCodeFence && codeFenceLines.Count > 0)
        {
            AddBlockSeparator(ref isFirstBlock, addExtraGapBeforeNextBlock);
            AppendCodeBlock(string.Join("\n", codeFenceLines));
        }
    }

    private void AppendMarkdownLine(string line)
    {
        var headerMatch = HeaderRegex.Match(line);
        if (headerMatch.Success)
        {
            var level = headerMatch.Groups[1].Value.Length;
            var headerText = headerMatch.Groups[2].Value.Trim();
            var span = new Span
            {
                FontWeight = FontWeights.Bold,
                FontSize = level switch
                {
                    1 => FontSize + 6,
                    2 => FontSize + 4,
                    3 => FontSize + 2,
                    _ => FontSize + 1,
                },
            };

            AddParsedInlines(span.Inlines, headerText);
            Inlines.Add(span);
            return;
        }

        var bulletMatch = BulletRegex.Match(line);
        if (bulletMatch.Success)
        {
            Inlines.Add(new Run("\u2022 ")
            {
                Foreground = _accentBrush,
                FontWeight = FontWeights.Bold,
            });
            AddParsedInlines(Inlines, bulletMatch.Groups[1].Value.Trim());
            return;
        }

        var orderedMatch = OrderedListRegex.Match(line);
        if (orderedMatch.Success)
        {
            Inlines.Add(new Run($"{orderedMatch.Groups[1].Value}. ")
            {
                Foreground = _accentBrush,
                FontWeight = FontWeights.Bold,
            });
            AddParsedInlines(Inlines, orderedMatch.Groups[2].Value.Trim());
            return;
        }

        var quoteMatch = QuoteRegex.Match(line);
        if (quoteMatch.Success)
        {
            Inlines.Add(new Run("\u2502 ")
            {
                Foreground = _accentBrush,
                FontWeight = FontWeights.Bold,
            });

            var quoteSpan = new Span
            {
                Foreground = _mutedBrush,
                FontStyle = FontStyles.Italic,
            };
            AddParsedInlines(quoteSpan.Inlines, quoteMatch.Groups[1].Value.Trim());
            Inlines.Add(quoteSpan);
            return;
        }

        AddParsedInlines(Inlines, line.TrimEnd());
    }

    private void AppendCodeBlock(string codeText)
    {
        if (string.IsNullOrWhiteSpace(codeText))
        {
            return;
        }

        Inlines.Add(new Run(codeText)
        {
            FontFamily = new System.Windows.Media.FontFamily("Consolas"),
            Background = _codeBackgroundBrush,
            Foreground = System.Windows.Media.Brushes.WhiteSmoke,
        });
    }

    private void AddParsedInlines(InlineCollection target, string text)
    {
        foreach (var inline in ParseInlineMarkdown(text))
        {
            target.Add(inline);
        }
    }

    private IEnumerable<Inline> ParseInlineMarkdown(string text)
    {
        var inlines = new List<Inline>();
        var plainTextBuffer = new StringBuilder();
        var index = 0;

        while (index < text.Length)
        {
            if (text[index] == '\\' && index + 1 < text.Length)
            {
                plainTextBuffer.Append(text[index + 1]);
                index += 2;
                continue;
            }

            if (StartsWith(text, index, "**") && TryFindClosing(text, index + 2, "**", out var boldEnd))
            {
                FlushPlainText(inlines, plainTextBuffer);
                var bold = new Bold();
                AddParsedInlines(bold.Inlines, text.Substring(index + 2, boldEnd - index - 2));
                inlines.Add(bold);
                index = boldEnd + 2;
                continue;
            }

            if (text[index] == '*' && TryFindClosing(text, index + 1, "*", out var italicEnd))
            {
                FlushPlainText(inlines, plainTextBuffer);
                var italic = new Italic();
                AddParsedInlines(italic.Inlines, text.Substring(index + 1, italicEnd - index - 1));
                inlines.Add(italic);
                index = italicEnd + 1;
                continue;
            }

            if (text[index] == '`' && TryFindClosing(text, index + 1, "`", out var codeEnd))
            {
                FlushPlainText(inlines, plainTextBuffer);
                inlines.Add(CreateCodeInline(text.Substring(index + 1, codeEnd - index - 1)));
                index = codeEnd + 1;
                continue;
            }

            if (text[index] == '[' && TryCreateLink(text, index, out var hyperlink, out var nextIndex))
            {
                FlushPlainText(inlines, plainTextBuffer);
                inlines.Add(hyperlink);
                index = nextIndex;
                continue;
            }

            plainTextBuffer.Append(text[index]);
            index++;
        }

        FlushPlainText(inlines, plainTextBuffer);
        return inlines;
    }

    private Inline CreateCodeInline(string text)
    {
        return new Run(text)
        {
            FontFamily = new System.Windows.Media.FontFamily("Consolas"),
            Background = _codeBackgroundBrush,
            Foreground = System.Windows.Media.Brushes.WhiteSmoke,
        };
    }

    private bool TryCreateLink(string text, int startIndex, out Hyperlink hyperlink, out int nextIndex)
    {
        hyperlink = null!;
        nextIndex = startIndex;

        var closingBracket = text.IndexOf(']', startIndex + 1);
        if (closingBracket < 0 || closingBracket + 1 >= text.Length || text[closingBracket + 1] != '(')
        {
            return false;
        }

        var closingParenthesis = text.IndexOf(')', closingBracket + 2);
        if (closingParenthesis < 0)
        {
            return false;
        }

        var label = text.Substring(startIndex + 1, closingBracket - startIndex - 1);
        var url = text.Substring(closingBracket + 2, closingParenthesis - closingBracket - 2);
        hyperlink = new Hyperlink
        {
            Foreground = _accentBrush,
            TextDecorations = System.Windows.TextDecorations.Underline,
        };
        AddParsedInlines(hyperlink.Inlines, label);

        if (Uri.TryCreate(url, UriKind.Absolute, out var uri))
        {
            hyperlink.NavigateUri = uri;
            hyperlink.Click += (_, _) =>
            {
                try
                {
                    Process.Start(new ProcessStartInfo(uri.AbsoluteUri)
                    {
                        UseShellExecute = true,
                    });
                }
                catch
                {
                }
            };
        }

        nextIndex = closingParenthesis + 1;
        return true;
    }

    private static void FlushPlainText(List<Inline> inlines, StringBuilder plainTextBuffer)
    {
        if (plainTextBuffer.Length == 0)
        {
            return;
        }

        inlines.Add(new Run(plainTextBuffer.ToString()));
        plainTextBuffer.Clear();
    }

    private static bool StartsWith(string text, int index, string token)
    {
        return index + token.Length <= text.Length &&
               string.Compare(text, index, token, 0, token.Length, StringComparison.Ordinal) == 0;
    }

    private static bool TryFindClosing(string text, int startIndex, string token, out int closingIndex)
    {
        closingIndex = -1;
        var searchIndex = startIndex;
        while (searchIndex < text.Length)
        {
            var foundIndex = text.IndexOf(token, searchIndex, StringComparison.Ordinal);
            if (foundIndex < 0)
            {
                return false;
            }

            if (foundIndex == 0 || text[foundIndex - 1] != '\\')
            {
                closingIndex = foundIndex;
                return true;
            }

            searchIndex = foundIndex + token.Length;
        }

        return false;
    }

    private void AddBlockSeparator(ref bool isFirstBlock, bool addExtraGap)
    {
        if (isFirstBlock)
        {
            isFirstBlock = false;
            return;
        }

        Inlines.Add(new LineBreak());
        if (addExtraGap)
        {
            Inlines.Add(new LineBreak());
        }
    }

    private static System.Windows.Media.Brush ResolveBrush(string key, System.Windows.Media.Brush fallback)
    {
        if (System.Windows.Application.Current?.TryFindResource(key) is System.Windows.Media.Brush brush)
        {
            return brush;
        }

        return fallback;
    }
}
