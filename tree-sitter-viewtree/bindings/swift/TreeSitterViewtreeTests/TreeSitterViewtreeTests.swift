import XCTest
import SwiftTreeSitter
import TreeSitterViewtree

final class TreeSitterViewtreeTests: XCTestCase {
    func testCanLoadGrammar() throws {
        let parser = Parser()
        let language = Language(language: tree_sitter_viewtree())
        XCTAssertNoThrow(try parser.setLanguage(language),
                         "Error loading Viewtree grammar")
    }
}
