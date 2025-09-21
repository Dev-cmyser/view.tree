#include <stdbool.h>
#include <string.h>
#include <tree_sitter/parser.h>

enum TokenType { NEWLINE, INDENT, DEDENT, EQINDENT };

typedef struct {
  uint32_t stack[1024];
  uint32_t size;
  bool at_line_start;
  bool emitted_final_newline;
} Scanner;

static inline bool is_tab(int32_t c) { return c == '\t'; }
static inline bool is_lf(int32_t c) { return c == '\n'; }
static inline bool is_cr(int32_t c) { return c == '\r'; }
static inline bool is_sp(int32_t c) { return c == ' '; }

void *tree_sitter_viewtree_external_scanner_create() {
  Scanner *s = (Scanner *)calloc(1, sizeof(Scanner));
  s->stack[0] = 0;
  s->size = 1;
  s->at_line_start = true;
  s->emitted_final_newline = false;
  return s;
}
void tree_sitter_viewtree_external_scanner_destroy(void *p) { free(p); }

unsigned tree_sitter_viewtree_external_scanner_serialize(void *p, char *b) {
  Scanner *s = (Scanner *)p;
  unsigned bytes = 0;
  memcpy(b + bytes, s->stack, s->size * sizeof(uint32_t));
  bytes += s->size * sizeof(uint32_t);
  b[bytes++] = (char)s->at_line_start;
  b[bytes++] = (char)s->emitted_final_newline;
  return bytes;
}
void tree_sitter_viewtree_external_scanner_deserialize(void *p, const char *b,
                                                       unsigned n) {
  Scanner *s = (Scanner *)p;
  if (n < 2) {
    s->stack[0] = 0;
    s->size = 1;
    s->at_line_start = true;
    s->emitted_final_newline = false;
    return;
  }
  unsigned count = (n - 2) / sizeof(uint32_t);
  s->size = count ? count : 1;
  memcpy(s->stack, b, s->size * sizeof(uint32_t));
  s->at_line_start = b[n - 2];
  s->emitted_final_newline = b[n - 1];
}

bool tree_sitter_viewtree_external_scanner_scan(void *p, TSLexer *lx,
                                                const bool valid[]) {
  Scanner *s = (Scanner *)p;

  // EOF: финальный NEWLINE (один раз), затем слить DEDENTы
  if (lx->eof(lx)) {
    if (!s->emitted_final_newline && valid[NEWLINE]) {
      s->emitted_final_newline = true;
      lx->result_symbol = NEWLINE;
      s->at_line_start = true;
      return true;
    }
    if (s->size > 1 && valid[DEDENT]) {
      s->size--;
      lx->result_symbol = DEDENT;
      return true;
    }
    return false;
  }

  // Голый LF => NEWLINE
  if (valid[NEWLINE] && is_lf(lx->lookahead)) {
    lx->advance(lx, true);
    lx->result_symbol = NEWLINE;
    s->at_line_start = true;
    return true;
  }

  // Начало логической строки: считаем \t и решаем INDENT/EQINDENT/DEDENT
  if (s->at_line_start && (valid[INDENT] || valid[DEDENT] || valid[EQINDENT])) {
    // игнорируем CR и ведущие пробелы (они не влияют на уровень)
    while (is_cr(lx->lookahead) || is_sp(lx->lookahead))
      lx->advance(lx, true);

    uint32_t tabs = 0;
    while (is_tab(lx->lookahead)) {
      lx->advance(lx, true);
      tabs++;
    }

    // пустая линия вида <tabs>* LF — NEWLINE поймается выше на след. вызове
    if (is_lf(lx->lookahead))
      return false;

    uint32_t prev = s->stack[s->size - 1];

    if (tabs > prev && valid[INDENT]) {
      s->stack[s->size++] = tabs;
      s->at_line_start = false;
      lx->result_symbol = INDENT;
      return true;
    }
    if (tabs == prev && valid[EQINDENT]) {
      s->at_line_start = false;
      lx->result_symbol = EQINDENT;
      return true;
    }
    if (tabs < prev && valid[DEDENT]) {
      s->size--; /* остаёмся at_line_start=true */
      lx->result_symbol = DEDENT;
      return true;
    }
    s->at_line_start = false;
    return false;
  }

  return false;
}
