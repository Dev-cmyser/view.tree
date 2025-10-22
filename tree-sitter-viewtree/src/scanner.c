#include "tree_sitter/array.h"
#include "tree_sitter/parser.h"
#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

enum TokenType {
  INDENT,
  DEDENT,
  NEWLINE,
};

typedef struct {
  Array(uint16_t) indents;
} Scanner;

static inline void advance(TSLexer *lexer) { lexer->advance(lexer, false); }

static inline void skip(TSLexer *lexer) { lexer->advance(lexer, true); }

void *tree_sitter_viewtree_external_scanner_create() {
  Scanner *scanner = (Scanner *)calloc(1, sizeof(Scanner));
  array_init(&scanner->indents);
  array_push(&scanner->indents, 0);
  return scanner;
}

void tree_sitter_viewtree_external_scanner_destroy(void *payload) {
  Scanner *scanner = (Scanner *)payload;
  array_delete(&scanner->indents);
  free(scanner);
}

unsigned tree_sitter_viewtree_external_scanner_serialize(void *payload,
                                                         char *buffer) {
  Scanner *scanner = (Scanner *)payload;
  size_t size = 0;

  uint32_t indent_count =
      scanner->indents.size < UINT8_MAX ? scanner->indents.size : UINT8_MAX;
  buffer[size++] = (char)indent_count;

  for (uint32_t i = 0;
       i < indent_count && size < TREE_SITTER_SERIALIZATION_BUFFER_SIZE; i++) {
    uint16_t indent = scanner->indents.contents[i];
    buffer[size++] = (char)(indent >> 8);
    buffer[size++] = (char)(indent & 0xFF);
  }

  return size;
}

void tree_sitter_viewtree_external_scanner_deserialize(void *payload,
                                                       const char *buffer,
                                                       unsigned length) {
  Scanner *scanner = (Scanner *)payload;
  array_clear(&scanner->indents);

  if (length == 0) {
    array_push(&scanner->indents, 0);
    return;
  }

  uint8_t indent_count = (uint8_t)buffer[0];
  size_t pos = 1;

  for (uint32_t i = 0; i < indent_count && pos + 1 < length; i++) {
    uint16_t indent = ((uint8_t)buffer[pos] << 8) | (uint8_t)buffer[pos + 1];
    array_push(&scanner->indents, indent);
    pos += 2;
  }

  if (scanner->indents.size == 0) {
    array_push(&scanner->indents, 0);
  }
}

bool tree_sitter_viewtree_external_scanner_scan(void *payload, TSLexer *lexer,
                                                const bool *valid_symbols) {
  Scanner *scanner = (Scanner *)payload;

  // Обрабатываем NEWLINE
  if (valid_symbols[NEWLINE]) {
    // Пропускаем пробелы
    while (lexer->lookahead == ' ') {
      skip(lexer);
    }

    // Если встретили перевод строки
    if (lexer->lookahead == '\n' || lexer->lookahead == '\r') {
      advance(lexer);

      // Пропускаем все последующие переводы строк (пустые строки)
      while (lexer->lookahead == '\n' || lexer->lookahead == '\r') {
        advance(lexer);
      }

      lexer->result_symbol = NEWLINE;
      lexer->mark_end(lexer);
      return true;
    }
  }

  // Пропускаем пробелы перед табами
  while (lexer->lookahead == ' ') {
    skip(lexer);
  }

  // Подсчитываем отступ (табы)
  if (valid_symbols[INDENT] || valid_symbols[DEDENT]) {
    uint16_t indent_length = 0;

    // Считаем табы
    while (lexer->lookahead == '\t') {
      indent_length++;
      advance(lexer);
    }

    // Пропускаем пробелы после табов
    while (lexer->lookahead == ' ') {
      skip(lexer);
    }

    // Игнорируем пустые строки
    if (lexer->lookahead == '\n' || lexer->lookahead == '\r' ||
        lexer->eof(lexer)) {
      return false;
    }

    uint16_t current_indent = *array_back(&scanner->indents);

    // INDENT: увеличение отступа
    if (valid_symbols[INDENT] && indent_length > current_indent) {
      array_push(&scanner->indents, indent_length);
      lexer->result_symbol = INDENT;
      return true;
    }

    // DEDENT: уменьшение отступа
    if (valid_symbols[DEDENT] && indent_length < current_indent) {
      array_pop(&scanner->indents);
      lexer->result_symbol = DEDENT;
      return true;
    }
  }

  return false;
}
