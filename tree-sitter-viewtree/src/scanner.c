#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <tree_sitter/parser.h>

enum TokenType {
  NEWLINE,
  INDENT,
  DEDENT,
  EQINDENT,
  COMMENT,
};

typedef struct {
  uint32_t indent_count;
  uint16_t indents[256];
} Scanner;

void *tree_sitter_viewtree_external_scanner_create() {
  Scanner *s = calloc(1, sizeof(Scanner));
  s->indent_count = 1;
  s->indents[0] = 0;
  return s;
}

void tree_sitter_viewtree_external_scanner_destroy(void *p) { free(p); }

unsigned tree_sitter_viewtree_external_scanner_serialize(void *p, char *buf) {
  Scanner *s = p;
  if (s->indent_count >= 128)
    return 0;
  buf[0] = (char)s->indent_count;
  for (uint32_t i = 0; i < s->indent_count; i++) {
    buf[1 + i * 2] = (char)(s->indents[i] >> 8);
    buf[2 + i * 2] = (char)(s->indents[i] & 0xFF);
  }
  return 1 + s->indent_count * 2;
}

void tree_sitter_viewtree_external_scanner_deserialize(void *p, const char *buf,
                                                       unsigned len) {
  Scanner *s = p;
  s->indent_count = 1;
  s->indents[0] = 0;
  if (len == 0)
    return;
  s->indent_count = (uint8_t)buf[0];
  if (s->indent_count > 128) {
    s->indent_count = 1;
    return;
  }
  for (uint32_t i = 0; i < s->indent_count && 1 + i * 2 + 1 < len; i++) {
    s->indents[i] = ((uint8_t)buf[1 + i * 2] << 8) | (uint8_t)buf[2 + i * 2];
  }
}

bool tree_sitter_viewtree_external_scanner_scan(void *p, TSLexer *lx,
                                                const bool *valid) {
  Scanner *s = p;

  bool found_eol = false;
  uint32_t indent_len = 0;

  // Скипаем \n и табы
  for (;;) {
    if (lx->lookahead == '\n') {
      found_eol = true;
      indent_len = 0;
      lx->advance(lx, true);
    } else if (lx->lookahead == '\t') {
      indent_len++;
      lx->advance(lx, true);
    } else if (lx->eof(lx)) {
      // EOF - возвращаем dedent до нулевого уровня
      if (valid[DEDENT] && s->indent_count > 1) {
        s->indent_count--;
        lx->result_symbol = DEDENT;
        return true;
      }
      return false;
    } else {
      break;
    }
  }

  if (!found_eol) {
    return false;
  }

  lx->mark_end(lx);

  if (s->indent_count == 0)
    return false;
  uint32_t cur = s->indents[s->indent_count - 1];
  uint32_t parent = s->indent_count > 1 ? s->indents[s->indent_count - 2] : 0;

  // EQINDENT - такой же отступ как текущий
  if (valid[EQINDENT] && indent_len == cur && s->indent_count > 1) {
    lx->result_symbol = EQINDENT;
    return true;
  }

  // INDENT - больше текущего отступа
  if (valid[INDENT] && indent_len > cur) {
    if (s->indent_count >= 255)
      return false;
    s->indents[s->indent_count++] = indent_len;
    lx->result_symbol = INDENT;
    return true;
  }

  // DEDENT - меньше или равен родительскому
  if (valid[DEDENT] && indent_len <= parent && s->indent_count > 1) {
    s->indent_count--;
    lx->result_symbol = DEDENT;
    return true;
  }

  // NEWLINE
  if (valid[NEWLINE]) {
    lx->result_symbol = NEWLINE;
    return true;
  }

  return false;
}
