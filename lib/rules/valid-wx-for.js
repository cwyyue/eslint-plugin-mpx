/**
 * @author pagnkelly
 * @copyright 2020 pagnkelly. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
'use strict'

// ------------------------------------------------------------------------------
// Requirements
// ------------------------------------------------------------------------------

const utils = require('../utils')

// ------------------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------------------

/**
 * Check whether the given attribute is using the variables which are defined by `wx:for` directives.
 * @param {VDirective} vFor The attribute node of `wx:for` to check.
 * @param {VDirective} vBindKey The attribute node of `wx:bind:key` to check.
 * @returns {boolean} `true` if the node is using the variables which are defined by `wx:for` directives.
 */
function isUsingIterationVar(vFor, vBindKey) {
  if (vBindKey.value == null) {
    return false
  }
  const references = vBindKey.value.references
  return references.some((reference) =>
    ['item', '*this'].includes(reference.id.name)
  )
}

/**
 * Check the child element in tempalte wx:for about `wx:bind:key` attributes.
 * @param {RuleContext} context The rule context to report.
 * @param {VDirective} vFor The attribute node of `wx:for` to check.
 * @param {VElement} child The child node to check.
 */
function checkChildKey(context, vFor, child) {
  const childFor = utils.getDirective(child, 'for')
  // if child has wx:for, check if parent iterator is used in wx:for
  if (childFor != null) {
    const childForRefs = (childFor.value && childFor.value.references) || []
    const variables = vFor.parent.parent.variables
    const usedInFor = childForRefs.some((cref) =>
      variables.some(
        (variable) =>
          cref.id.name === variable.id.name && variable.kind === 'wx:for'
      )
    )
    // if parent iterator is used, skip other checks
    // iterator usage will be checked later by child wx:for
    if (usedInFor) {
      return
    }
  }
  // otherwise, check if parent iterator is directly used in child's key
  checkKey(context, vFor, child)
}

/**
 * Check the given element about `wx:bind:key` attributes.
 * @param {RuleContext} context The rule context to report.
 * @param {VDirective} vFor The attribute node of `wx:for` to check.
 * @param {VElement} element The element node to check.
 */
function checkKey(context, vFor, element) {
  if (element.name === 'template') {
    for (const child of element.children) {
      if (child.type === 'VElement') {
        checkChildKey(context, vFor, child)
      }
    }
    return
  }

  const vBindKey = utils.getDirective(element, 'key')
  if (utils.isCustomComponent(element) && vBindKey == null) {
    context.report({
      node: element.startTag,
      loc: element.startTag.loc,
      message: "Custom elements in iteration require 'wx:key' directives."
    })
  }
  if (vBindKey != null && !isUsingIterationVar(vFor, vBindKey)) {
    context.report({
      node: vBindKey,
      loc: vBindKey.loc,
      message:
        "Expected 'wx:key' directive to use the variables which are defined by the 'wx:for' directive."
    })
  }
}

// ------------------------------------------------------------------------------
// Rule Definition
// ------------------------------------------------------------------------------

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'enforce valid `wx:for` directives',
      categories: [],
      url: 'https://mpx-ecology.github.io/eslint-plugin-mpx/rules/valid-wx-for.html'
    },
    fixable: null,
    schema: []
  },
  /** @param {RuleContext} context */
  create(context) {
    const sourceCode = context.getSourceCode()

    return utils.defineTemplateBodyVisitor(context, {
      /** @param {VDirective} node */
      "VAttribute[directive=true][key.name.name='for']"(node) {
        const element = node.parent.parent

        checkKey(context, node, element)

        if (node.key.argument) {
          context.report({
            node,
            loc: node.loc,
            message: "'wx:for' directives require no argument."
          })
        }
        if (node.key.modifiers.length > 0) {
          context.report({
            node,
            loc: node.loc,
            message: "'wx:for' directives require no modifier."
          })
        }
        if (!node.value || utils.isEmptyValueDirective(node, context)) {
          context.report({
            node,
            loc: node.loc,
            message: "'wx:for' directives require that attribute value."
          })
          return
        }

        const expr = node.value.expression
        if (expr == null) {
          return
        }
        if (expr.type !== 'VForExpression') {
          context.report({
            node: node.value,
            loc: node.value.loc,
            message:
              "'wx:for' directives require the special syntax '<alias> in <expression>'."
          })
          return
        }

        const lhs = expr.left
        const value = lhs[0]
        const key = lhs[1]
        const index = lhs[2]

        if (value === null) {
          context.report({
            node: expr,
            message: "Invalid alias ''."
          })
        }
        if (key !== undefined && (!key || key.type !== 'Identifier')) {
          context.report({
            node: key || expr,
            loc: key && key.loc,
            message: "Invalid alias '{{text}}'.",
            data: { text: key ? sourceCode.getText(key) : '' }
          })
        }
        if (index !== undefined && (!index || index.type !== 'Identifier')) {
          context.report({
            node: index || expr,
            loc: index && index.loc,
            message: "Invalid alias '{{text}}'.",
            data: { text: index ? sourceCode.getText(index) : '' }
          })
        }
      }
    })
  }
}
