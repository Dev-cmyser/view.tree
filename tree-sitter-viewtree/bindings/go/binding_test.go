package tree_sitter_viewtree_test

import (
	"testing"

	tree_sitter "github.com/tree-sitter/go-tree-sitter"
	tree_sitter_viewtree "github.com/tree-sitter/tree-sitter-viewtree/bindings/go"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_viewtree.Language())
	if language == nil {
		t.Errorf("Error loading Viewtree grammar")
	}
}
