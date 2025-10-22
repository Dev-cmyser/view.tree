#include "tree_sitter/parser.h"
#include "tree_sitter/array.h"
#include <wctype.h>

enum TokenType {
    INDENT,
    DEDENT,
    NEWLINE,
};

typedef struct {
    Array(uint16_t) indents;
} Scanner;

static inline void advance(TSLexer *lexer) {
    lexer->advance(lexer, false);
}

static inline void skip(TSLexer *lexer) {
    lexer->advance(lexer, true);
}

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

unsigned tree_sitter_viewtree_external_scanner_serialize(void *payload, char *buffer) {
    Scanner *scanner = (Scanner *)payload;
    size_t size = scanner->indents.size;
    if (size * sizeof(uint16_t) > TREE_SITTER_SERIALIZATION_BUFFER_SIZE) {
        size = TREE_SITTER_SERIALIZATION_BUFFER_SIZE / sizeof(uint16_t);
    }
    memcpy(buffer, scanner->indents.contents, size * sizeof(uint16_t));
    return size * sizeof(uint16_t);
}

void tree_sitter_viewtree_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {
    Scanner *scanner = (Scanner *)payload;
    array_clear(&scanner->indents);
    
    if (length > 0) {
        size_t size = length / sizeof(uint16_t);
        array_reserve(&scanner->indents, size);
        memcpy(scanner->indents.contents, buffer, length);
        scanner->indents.size = size;
    } else {
        array_push(&scanner->indents, 0);
    }
}

bool tree_sitter_viewtree_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
    Scanner *scanner = (Scanner *)payload;

    // Handle NEWLINE - this actually consumes characters
    if (valid_symbols[NEWLINE]) {
        if (lexer->lookahead == '\n') {
            advance(lexer);
            if (lexer->lookahead == '\r') {
                advance(lexer);
            }
            lexer->mark_end(lexer);
            lexer->result_symbol = NEWLINE;
            return true;
        }
        if (lexer->lookahead == '\r') {
            advance(lexer);
            if (lexer->lookahead == '\n') {
                advance(lexer);
            }
            lexer->mark_end(lexer);
            lexer->result_symbol = NEWLINE;
            return true;
        }
    }

    // Handle INDENT/DEDENT - these are zero-width tokens
    if (!valid_symbols[INDENT] && !valid_symbols[DEDENT]) {
        return false;
    }

    // Mark end at current position (before counting tabs)
    // This makes INDENT/DEDENT zero-width tokens
    lexer->mark_end(lexer);

    // At EOF, treat as indent level 0
    bool at_eof = lexer->eof(lexer);
    
    // Count tabs
    uint16_t indent_length = 0;
    if (!at_eof) {
        while (lexer->lookahead == '\t') {
            indent_length++;
            skip(lexer);
        }

        // Skip empty lines (but not EOF)
        if (lexer->lookahead == '\n' || lexer->lookahead == '\r') {
            return false;
        }
    }

    uint16_t current_indent = *array_back(&scanner->indents);

    // Emit INDENT if indentation increased
    if (indent_length > current_indent && valid_symbols[INDENT]) {
        array_push(&scanner->indents, indent_length);
        lexer->result_symbol = INDENT;
        return true;
    }

    // Emit DEDENT if indentation decreased (or at EOF with indent > 0)
    if (indent_length < current_indent && valid_symbols[DEDENT]) {
        array_pop(&scanner->indents);
        lexer->result_symbol = DEDENT;
        return true;
    }

    return false;
}
