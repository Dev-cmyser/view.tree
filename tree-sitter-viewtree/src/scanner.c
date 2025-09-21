
// src/scanner.c — внешний сканер для viewtree: LF, INDENT/DEDENT по количеству
// табов. Строго табы в начале строки. Пустые строки учитываются (как NEWLINE).
#include <stdbool.h>
#include <string.h>
#include <tree_sitter/parser.h>

enum TokenType {
  NEWLINE, // $._newline
  INDENT,  // $._indent
  DEDENT,  // $._dedent
};

typedef struct {
  uint32_t stack[1024];
  uint32_t size;
  bool at_line_start;
  bool emitted_final_newline;
} Scanner;

void *tree_sitter_viewtree_external_scanner_create() {
  Scanner *s = (Scanner *)calloc(1, sizeof(Scanner));
  s->size = 1;
  s->stack[0] = 0; // базовый уровень
  s->at_line_start = true;
  s->emitted_final_newline = false;
  return s;
}

void tree_sitter_viewtree_external_scanner_destroy(void *payload) {
  free(payload);
}

unsigned tree_sitter_viewtree_external_scanner_serialize(void *payload,
                                                         char *buffer) {
  Scanner *s = (Scanner *)payload;
  unsigned bytes = 0;
  memcpy(buffer + bytes, s->stack, s->size * sizeof(uint32_t));
  bytes += s->size * sizeof(uint32_t);
  buffer[bytes++] = (char)s->at_line_start;
  buffer[bytes++] = (char)s->emitted_final_newline;
  return bytes;
}

void tree_sitter_viewtree_external_scanner_deserialize(void *payload,
                                                       const char *buffer,
                                                       unsigned length) {
  Scanner *s = (Scanner *)payload;
  if (length < 2) {
    s->size = 1;
    s->stack[0] = 0;
    s->at_line_start = true;
    s->emitted_final_newline = false;
    return;
  }
  unsigned count = (length - 2) / sizeof(uint32_t);
  s->size = count ? count : 1;
  memcpy(s->stack, buffer, s->size * sizeof(uint32_t));
  s->at_line_start = buffer[length - 2];
  s->emitted_final_newline = buffer[length - 1];
}

static inline bool is_tab(int32_t c) { return c == '\t'; }
static inline bool is_lf(int32_t c) { return c == '\n'; }

bool tree_sitter_viewtree_external_scanner_scan(void *payload, TSLexer *lx,
                                                const bool *valid) {
  Scanner *s = (Scanner *)payload;

  // EOF: сначала единоразово отдать финальный NEWLINE (требование "файл
  // заканчивается LF"), затем сдренить все DEDENT до нуля.
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

  int32_t c = lx->lookahead;

  // Явный перевод строки
  if (valid[NEWLINE] && is_lf(c)) {
    lx->advance(lx, true);
    lx->result_symbol = NEWLINE;
    s->at_line_start = true;
    return true;
  }

  // Обработка отступа только в самом начале строки
  if (s->at_line_start && (valid[INDENT] || valid[DEDENT])) {
    // Считаем ТОЛЬКО табы
    uint32_t col = 0;
    while (is_tab(lx->lookahead)) {
      lx->advance(lx, true);
      col++;
    }
    s->at_line_start = false;

    uint32_t prev = s->stack[s->size - 1];

    if (col > prev && valid[INDENT]) {
      s->stack[s->size++] = col;
      lx->result_symbol = INDENT;
      return true;
    }
    if (col < prev && valid[DEDENT]) {
      // отдаём по одному DEDENT за вызов
      s->size--;
      lx->result_symbol = DEDENT;
      return true;
    }
    // col == prev: ни indent, ни dedent
  }

  return false;
}
