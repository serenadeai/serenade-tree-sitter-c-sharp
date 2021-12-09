const PREC = {
  DOT: 18,
  INVOCATION: 18,
  POSTFIX: 18,
  PREFIX: 17,
  UNARY: 17,
  CAST: 17,
  RANGE: 16,
  SWITCH: 15,
  WITH: 14,
  MULT: 13,
  ADD: 12,
  SHIFT: 11,
  REL: 10,
  EQUAL: 9,
  AND: 8,
  XOR: 7,
  OR: 6,
  LOGAND: 5,
  LOGOR: 4,
  COALESCING: 3,
  COND: 2,
  ASSIGN: 1,
  SELECT: 0,
  TYPE_PATTERN: -2,
};

const decimalDigitSequence = /([0-9][0-9_]*[0-9]|[0-9])/;

module.exports = grammar({
  name: 'c_sharp',

  extras: $ => [
    $.comment,
    /[\s\u00A0\uFEFF\u3000]+/,
    $.preprocessor_call
  ],

  supertypes: $ => [
  ],

  externals: $ => [
    $._preproc_directive_end,
  ],

  conflicts: $ => [
    [$.enclosed_body, $.initializer_expression],

    [$.event_declaration, $.assignment],

    [$.nullable_type, $.as_expression],
    [$.nullable_type, $.is_expression, $.type_pattern],
    [$.nullable_type, $.as_expression, $.type_pattern],

    [$._name, $.expression_],
    [$._simple_name, $.type_parameter],
    [$._simple_name, $.generic_name],
    [$._simple_name, $.constructor_declaration],

    [$.qualified_name, $.explicit_interface_specifier],
    [$.qualified_name, $.member_access_expression],

    [$._contextual_keywords, $.from_clause],
    [$._contextual_keywords, $.global],
    [$._contextual_keywords, $.accessor_declaration],
    [$._contextual_keywords, $.type_parameter_constraint],

    [$.type, $.array_creation_expression],
    [$.type, $.stack_alloc_array_creation_expression],

    [$.parameter_modifier, $.this_expression],
    [$.parameter, $._simple_name],
    [$.parameter, $.tuple_element],
    [$.parameter, $.tuple_element, $.declaration_expression],
    [$.parameter, $._pattern],
    [$.parameter, $.declaration_expression],
    [$.tuple_element],
    [$.tuple_element, $.declaration_expression],
    [$.tuple_element, $.assignment],

    [$.array_creation_expression, $.element_access_expression], 
    
    [$.if], 
    [$.if_clause, $.else_if_clause],
    // `if_clause`, `else_if_clause`
  ],

  inline: $ => [
    $.return_type,
    $._identifier_or_global,
  ],

  word: $ => $._identifier_token,

  rules: {
    program: $ => seq(
      optional_with_placeholder('directives_list', seq(
        repeat($.extern_alias_directive),
        repeat($.using)
      )),
      optional_with_placeholder('global_attributes_list', repeat($.global_attribute_list)),
      optional_with_placeholder('statement_list', seq(
        repeat($.top_level_statement),
        repeat($.namespace_member_declaration)
      ))
    ),

    top_level_statement: $ => $.statement,

    declaration_: $ => field('member', choice(
      $.class,
      $.constructor_declaration,
      $.conversion_operator_declaration,
      $.delegate_declaration,
      $.destructor_declaration,
      $.enum,
      $.event_declaration,
      $.event_field_declaration,
      $.field_declaration,
      $.indexer_declaration,
      $.interface,
      $.method,
      $.namespace_declaration,
      $.operator_declaration,
      $.property_declaration,
      $.record_declaration,
      $.struct_declaration,
      $.using,
    )),

    namespace_member_declaration: $ => field('statement', choice(
      $.namespace_declaration,
      $._type_declaration
    )),

    _type_declaration: $ => choice(
      $.class,
      $.struct_declaration,
      $.interface,
      $.enum,
      $.delegate_declaration,
      $.record_declaration
    ),

    extern_alias_directive: $ => seq('extern', 'alias', $.identifier, ';'),

    using: $ => seq(
      'using',
      optional(choice(
        $.static_modifier,
        $.name_equals
      )),
      $._name,
      ';'
    ),

    name_equals: $ => prec(1, seq($._identifier_or_global, '=')),

    _name: $ => choice(
      $.alias_qualified_name,
      $.qualified_name,
      $._simple_name
    ),

    alias_qualified_name: $ => seq($._identifier_or_global, '::', $._simple_name),

    _simple_name: $ => choice(
      $.generic_name,
      $._identifier_or_global
    ),

    generic_name: $ => seq($.identifier, $.type_argument_list),

    // Intentionally different from Roslyn to avoid non-matching
    // omitted_type_argument in a lot of unnecessary places.
    type_argument_list: $ => seq(
      '<',
      choice(
        repeat(','),
        commaSep1($.type),
      ),
      '>'
    ),

    qualified_name: $ => prec(PREC.DOT, seq($._name, '.', $._simple_name)),

    attribute_list: $ => seq(
      '[',
      field('attribute_body', seq(
        optional($.attribute_target_specifier),
        commaSep1($.attribute),
        optional(',')
      )),
      ']'
    ),

    attribute_target_specifier: $ => seq(
      choice('field', 'event', 'method', 'param', 'property', 'return', 'type'),
      ':'
    ),

    attribute: $ => seq(
      field('name', $._name),
      optional($.attribute_argument_list)
    ),

    attribute_argument_list: $ => seq(
      '(',
      commaSep($.attribute_argument),
      ')'
    ),

    attribute_argument: $ => seq(
      optional(choice($.name_equals, $.name_colon)),
      $.expression_
    ),

    global_attribute_list: $ => seq(
      '[',
      choice('assembly', 'module'),
      ':',
      commaSep($.attribute),
      ']'
    ),

    name_colon: $ => seq($._identifier_or_global, ':'),

    event_field_declaration: $ => prec.dynamic(1, seq(
      optional_with_placeholder('attribute_list_placeholder', repeat($.attribute_list)),
      optional_with_placeholder('modifier_list', repeat($.modifier)),
      'event',
      $.assignment_with_type,
      ';'
    )),

    await_modifier: $ => field('modifier', 'await'),
    async_modifier: $ => field('modifier', 'async'),
    static_modifier: $ => field('modifier', 'static'), 
  
    modifier: $ => prec.right(choice(
      'abstract',
      $.async_modifier,
      'const',
      'extern',
      'fixed',
      'internal',
      'new',
      'override',
      'partial',
      'private',
      'protected',
      'public',
      'readonly',
      prec(1, 'ref'), //make sure that 'ref' is treated as a modifier for local variable declarations instead of as a ref expression
      'sealed',
      $.static_modifier,
      'unsafe',
      'virtual',
      'volatile'
    )),

    assignment_with_type: $ => seq(
      field('type_optional', $.type),
      $.assignment_list
    ),

    assignment_list: $ => commaSep1($.assignment), 

    assignment: $ => seq(
      field('assignment_variable', choice($.identifier, $.tuple_pattern)),
      optional($.bracketed_argument_list),
      optional_with_placeholder('assignment_value_list_optional', $.equals_value_clause)
    ),

    bracketed_argument_list: $ => seq(
      '[',
      commaSep1($.argument),
      ']'
    ),

    tuple_pattern: $ => seq(
      '(',
      commaSep1(choice($.identifier, $.discard, $.tuple_pattern)),
      ')'
    ),

    argument: $ => prec(1, seq(
      optional($.name_colon),
      optional(choice('ref', 'out', 'in')),
      choice(
        $.expression_,
        $.declaration_expression
      )
    )),

    equals_value_clause: $ => seq('=', field('assignment_value', $.expression_)),

    field_declaration: $ => seq(
      optional_with_placeholder('attribute_list_placeholder', repeat($.attribute_list)),
      optional_with_placeholder('modifier_list', repeat($.modifier)),
      $.assignment_with_type,
      ';'
    ),

    constructor_declaration: $ => seq(
      optional_with_placeholder('attribute_list_placeholder', repeat($.attribute_list)),
      optional_with_placeholder('modifier_list', repeat($.modifier)),
      field('name', $.identifier),
      field('parameters', $.parameter_block),
      optional($.constructor_initializer),
      $.function_body
    ),

    // Params varies quite a lot from grammar.txt as that handles neither 'out' nor 'params' or arrays...

    parameter_block: $ => seq(
      '(',
      optional_with_placeholder('parameter_list', $._formal_parameter_list),
      ')'
    ),

    _formal_parameter_list: $ => commaSep1(choice(
      $.parameter,
      $.parameter_array
    )),

    parameter: $ => seq(
      optional_with_placeholder('attribute_list_placeholder', repeat($.attribute_list)),
      optional_with_placeholder('modifier_list', $.parameter_modifier),
      optional_with_placeholder('type_optional', $.type),
      field('name', $.identifier),
      optional($.equals_value_clause)
    ),

    parameter_modifier: $ => prec.right(field('modifier', choice('ref', 'out', 'this', 'in'))),

    parameter_array: $ => seq(
      optional_with_placeholder('attribute_list_placeholder', repeat($.attribute_list)),
      'params',
      choice($.array_type, $.nullable_type),
      $.identifier
    ),

    constructor_initializer: $ => seq(
      ':',
      choice('base', 'this'),
      $.argument_list_parens
    ),

    argument_list_parens: $ => seq('(', 
      optional_with_placeholder('argument_list', commaSep($.argument)), 
      ')'
    ),

    enclosed_body: $ => seq(
      '{', 
      optional_with_placeholder('statement_list', repeat($.statement)), 
      '}'
    ),

    arrow_expression_clause: $ => seq('=>', $.expression_),

    conversion_operator_declaration: $ => seq(
      optional_with_placeholder('attribute_list_placeholder', repeat($.attribute_list)),
      optional_with_placeholder('modifier_list', repeat($.modifier)),
      choice(
        'implicit',
        'explicit'
      ),
      'operator',
      field('type_optional', $.type),
      field('parameters', $.parameter_block),
      $.function_body,
    ),

    function_body: $ => choice(
      field('body', $.enclosed_body),
      seq(field('statement', $.arrow_expression_clause), ';'),
      ';' // Only applies to interfaces
    ),

    destructor_declaration: $ => seq(
      optional_with_placeholder('attribute_list_placeholder', repeat($.attribute_list)),
      optional('extern'),
      '~',
      $.identifier,
      $.parameter_block,
      $.function_body
    ),

    method: $ => seq(
      optional_with_placeholder('attribute_list_placeholder', repeat($.attribute_list)),
      optional_with_placeholder('modifier_list', repeat($.modifier)),
      field('type_optional', $.return_type),
      field('identifier', seq(
        optional($.explicit_interface_specifier),
        $.identifier
      )),
      optional($.type_parameter_list),
      field('parameters', $.parameter_block),
      optional_with_placeholder('type_parameter_constraint_list_optional', $.type_parameter_constraint_list),
      field('method_body', $.function_body),
    ),

    explicit_interface_specifier: $ => prec(PREC.DOT, seq($._name, '.')),

    type_parameter_list: $ => seq('<', commaSep1($.type_parameter), '>'),

    type_parameter: $ => seq(
      optional_with_placeholder('attribute_list_placeholder', repeat($.attribute_list)),
      optional(choice('in', 'out')),
      $.identifier
    ),

    type_parameter_constraint_list: $ => repeat1($.type_parameter_constraint_type),
    
    type_parameter_constraint_type: $ => seq(
      'where',
      field('target', $._identifier_or_global),
      ':',
      field('constraints', commaSep1($.type_parameter_constraint)),
    ),

    type_parameter_constraint: $ => choice(
      seq('class', optional('?')),
      'struct',
      'notnull',
      'unmanaged',
      $.constructor_constraint,
      $.type_constraint
    ),

    constructor_constraint: $ => seq('new', '(', ')'),

    type_constraint: $ => field('type_optional', $.type),

    operator_declaration: $ => seq(
      optional_with_placeholder('attribute_list_placeholder', repeat($.attribute_list)),
      optional_with_placeholder('modifier_list', repeat($.modifier)),
      field('type_optional', $.type),
      'operator',
      field('operator', $._overloadable_operator),
      field('parameters', $.parameter_block),
      $.function_body,
    ),

    _overloadable_operator: $ => choice(
      '!',
      '~',
      '++',
      '--',
      'true',
      'false',
      '+', '-',
      '*', '/',
      '%', '^',
      '|', '&',
      '<<', '>>',
      '==', '!=',
      '>', '<',
      '>=', '<='
    ),

    event_declaration: $ => seq(
      optional_with_placeholder('attribute_list_placeholder', repeat($.attribute_list)),
      optional_with_placeholder('modifier_list', repeat($.modifier)),
      'event',
      field('type_optional', $.type),
      optional($.explicit_interface_specifier),
      field('name', $.identifier),
      choice(
        field('accessors', $.accessor_list),
        ';'
      )
    ),

    accessor_list: $ => seq(
      '{',
      repeat($.accessor_declaration),
      '}'
    ),

    accessor_declaration: $ => seq(
      optional_with_placeholder('attribute_list_placeholder', repeat($.attribute_list)),
      optional_with_placeholder('modifier_list', repeat($.modifier)),
      choice('get', 'set', 'add', 'remove', 'init', $.identifier),
      $.function_body
    ),

    indexer_declaration: $ => seq(
      optional_with_placeholder('attribute_list_placeholder', repeat($.attribute_list)),
      optional_with_placeholder('modifier_list', repeat($.modifier)),
      field('type_optional', $.type),
      optional($.explicit_interface_specifier),
      'this',
      field('parameters', $.bracketed_parameter_list),
      choice(
        field('accessors', $.accessor_list),
        seq(field('value', $.arrow_expression_clause), ';')
      )
    ),

    bracketed_parameter_list: $ => seq('[', commaSep1($.parameter), ']'),

    property_declaration: $ => seq(
      optional_with_placeholder('attribute_list_placeholder', repeat($.attribute_list)),
      optional_with_placeholder('modifier_list', repeat($.modifier)),
      field('type_optional', $.type),
      optional($.explicit_interface_specifier),
      field('name', $.identifier),
      choice(
        seq(
          field('accessors', $.accessor_list),
          optional(seq('=', field('value', $.expression_), ';'))
        ), // grammar.txt does not allow bodyless properties.
        seq(
          field('value', $.arrow_expression_clause),
          ';'
        )
      ),
    ),

    enum: $ => seq(
      optional_with_placeholder('attribute_list_placeholder', repeat($.attribute_list)),
      optional_with_placeholder('modifier_list', repeat($.modifier)),
      'enum',
      field('name', $.identifier),
      optional_with_placeholder('extends_list_optional', $.base_list),
      field('enclosed_body', $.enum_member_block),
      optional(';')
    ),

    extends_list: $ => commaSep1(field('extends_type', $.type)),
    base_list: $ => seq(':', $.extends_list),

    enum_member_block: $ => seq(
      '{',
      optional_with_placeholder('enum_member_list', seq(
        commaSep(alias($.enum_member_declaration, $.member)),
        optional(',')
      )),
      '}',
    ),

    enum_member_declaration: $ => seq(
      optional_with_placeholder('attribute_list_placeholder', repeat($.attribute_list)),
      field('name', $.identifier),
      optional(seq('=', field('value', $.expression_)))
    ),

    class: $ => seq(
      optional_with_placeholder('attribute_list_placeholder', repeat($.attribute_list)),
      optional_with_placeholder('modifier_list', repeat($.modifier)),
      'class',
      field('name', $.identifier),
      optional($.type_parameter_list),
      optional_with_placeholder('extends_list_optional', $.base_list),
      optional_with_placeholder('type_parameter_constraint_list_optional', $.type_parameter_constraint_list),
      field('enclosed_body', $.class_member_block),
      optional(';')
    ),

    class_member_block: $ => seq(
      '{',
      optional_with_placeholder('class_member_list', repeat($.declaration_)),
      '}'
    ),
    
    interface_member_block: $ => seq(
      '{',
      optional_with_placeholder('interface_member_list', repeat($.declaration_)),
      '}'
    ),

    // Copy of declaration_list, since we need to rename the inner children. 
    declaration_list: $ => seq(
      '{',
      optional_with_placeholder('declaration_member_list', repeat($.declaration_)),
      '}'
    ),

    interface: $ => seq(
      optional_with_placeholder('attribute_list_placeholder', repeat($.attribute_list)),
      optional_with_placeholder('modifier_list', repeat($.modifier)),
      'interface',
      field('name', $.identifier),
      optional($.type_parameter_list),
      optional_with_placeholder('extends_list_optional', $.base_list),
      optional_with_placeholder('type_parameter_constraint_list_optional', $.type_parameter_constraint_list),
      field('enclosed_body', $.interface_member_block),
      optional(';')
    ),

    struct_declaration: $ => seq(
      optional_with_placeholder('attribute_list_placeholder', repeat($.attribute_list)),
      optional_with_placeholder('modifier_list', repeat($.modifier)),
      'struct',
      field('name', $.identifier),
      optional($.type_parameter_list),
      optional_with_placeholder('extends_list_optional', $.base_list),
      optional_with_placeholder('type_parameter_constraint_list_optional', $.type_parameter_constraint_list),
      field('body', $.declaration_list),
      optional(';')
    ),

    delegate_declaration: $ => seq(
      optional_with_placeholder('attribute_list_placeholder', repeat($.attribute_list)),
      optional_with_placeholder('modifier_list', repeat($.modifier)),
      'delegate',
      field('type_optional', $.return_type),
      field('name', $.identifier),
      optional($.type_parameter_list),
      field('parameters', $.parameter_block),
      optional_with_placeholder('type_parameter_constraint_list_optional', $.type_parameter_constraint_list),
      ';'
    ),

    record_declaration: $ => seq(
      optional_with_placeholder('attribute_list_placeholder', repeat($.attribute_list)),
      optional_with_placeholder('modifier_list', repeat($.modifier)),
      'record',
      field('name', $.identifier),
      optional($.type_parameter_list),
      optional(field('parameters', $.parameter_block)),
      optional(field('bases', alias($.record_base, $.base_list))),
      optional_with_placeholder('type_parameter_constraint_list_optional', $.type_parameter_constraint_list),
      field('body', $._record_body),
    ),

    record_base: $ => choice(
      seq(':', commaSep1($.identifier)),
      seq(':', $.primary_constructor_base_type, optional(seq(',', commaSep1($.identifier)))),
    ),

    primary_constructor_base_type: $ => seq(
      $.identifier,
      $.argument_list_parens
    ),

    _record_body: $ => choice(
      $.declaration_list,
      ';'
    ),

    namespace_declaration: $ => seq(
      'namespace',
      field('name', $._name),
      field('body', $.declaration_list),
      optional(';')
    ),

    type: $ => choice(
      $.implicit_type,
      $.array_type,
      $._name,
      $.nullable_type,
      $.pointer_type,
      $.function_pointer_type,
      $.predefined_type,
      $.tuple_type,
    ),

    implicit_type: $ => 'var',

    array_type: $ => prec(PREC.POSTFIX, seq(
      field('type_optional', $.type),
      field('rank', $.array_rank_specifier)
    )),

    // grammar.txt marks this non-optional and includes omitted_array_size_expression in
    // expression but we can't match empty rules.
    array_rank_specifier: $ => seq('[', commaSep(optional($.expression_)), ']'),

    // When used in a nullable type, the '?' operator binds tighter than the
    // binary operators `as` and `is`. But in a conditional expression, the `?`
    // binds *looser*. This weird double precedence is required in order to
    // preserve the conflict, so that `?` can be used in both ways, depending
    // on what follows.
    nullable_type: $ => choice(
      prec(PREC.EQUAL + 1, seq($.type, '?')),
      prec(PREC.COND - 1, seq($.type, '?'))
    ),

    pointer_type: $ => prec(PREC.POSTFIX, seq($.type, '*')),

    function_pointer_type: $ => seq(
      'delegate',
      '*',
      optional($.function_pointer_calling_convention),
      '<',
      commaSep1($.function_pointer_parameter),
      '>'
    ),

    function_pointer_calling_convention: $ => choice(
      'managed',
      seq(
        'unmanaged',
        optional($.function_pointer_unmanaged_calling_convention_list)
      )
    ),

    function_pointer_unmanaged_calling_convention_list: $ => seq(
      '[', commaSep1($.function_pointer_unmanaged_calling_convention), ']'
    ),

    function_pointer_unmanaged_calling_convention: $ => choice(
      'Cdecl',
      'Stdcall',
      'Thiscall',
      'Fastcall',
      $.identifier
    ),

    function_pointer_parameter: $ => seq(
      optional(choice('ref', 'out', 'in', seq('ref', 'readonly'))),
      choice($.type, $.void_keyword)
    ),

    predefined_type: $ => token(choice(
      'bool',
      'byte',
      'char',
      'decimal',
      'double',
      'float',
      'int',
      'long',
      'object',
      'sbyte',
      'short',
      'string',
      'uint',
      'ulong',
      'ushort',
      'nint',
      'nuint'
      // void is handled in return_type for better matching
    )),

    ref_type: $ => seq(
      'ref',
      optional('readonly'),
      $.type
    ),

    tuple_type: $ => seq(
      '(',
      $.tuple_element,
      ',',
      commaSep1($.tuple_element),
      ')'
    ),

    tuple_element: $ => prec.left(seq(
      field('type_optional', $.type),
      optional($.identifier)
    )),

    statement: $ => choice(
      $.enclosed_body,
      $.break_statement,
      $.checked_statement,
      $.continue_statement,
      $.do_statement,
      $.empty_statement,
      $.expression_statement,
      $.fixed_statement,
      $.for,
      $.goto_statement,
      $.if,
      $.labeled_statement,
      $.local_declaration_statement,
      $.local_function_statement,
      $.lock_statement,
      $.return,
      $.switch_statement,
      $.throw,
      $.try,
      $.unsafe_statement,
      $.using_statement,
      $.while,
      $.yield_statement,
    ),

    break_statement: $ => seq('break', ';'),

    checked_statement: $ => seq(choice('checked', 'unchecked'), $.enclosed_body),

    continue_statement: $ => seq('continue', ';'),

    do_statement: $ => seq('do', $.statement, 'while', '(', $.expression_, ')', ';'),

    empty_statement: $ => ';',

    expression_statement: $ => seq($.expression_, ';'),

    fixed_statement: $ => seq('fixed', '(', $.assignment_with_type, ')', $.statement),

    condition: $ => $.expression_, 

    block_initializer: $ => choice($.assignment_with_type, commaSep1($.expression_)), 

    block_update: $ => commaSep1($.expression_), 

    for: $ => choice(
      $.for_clause,
      $.for_each_clause
    ),

    for_clause: $ => seq(
      'for',
      '(',
      optional_with_placeholder('block_initializer_optional', $.block_initializer),
      ';',
      optional_with_placeholder('condition_optional', $.condition),
      ';',
      optional_with_placeholder('block_update_optional', $.block_update),
      ')',
      field('for_body', $.statement)
    ),

    // Combines for_each_statement and for_each_variable_statement from grammar.txt
    block_iterator: $ => choice(
      seq(
        field('type_optional', $.type),
        choice($.identifier, $.tuple_pattern),
      ), // for_each_statement
      $.expression_, // for_each_variable_statement
    ), 

    for_each_clause: $ => seq(
      optional_with_placeholder('modifier_list', $.await_modifier),
      'foreach',
      '(',
      $.block_iterator,
      field('for_each_separator', 'in'),
      field('block_collection', $.expression_),
      ')',
      field('for_each_body', $.statement)
    ),

    // grammar.txt one doesn't seem to make sense so we do this instead
    goto_statement: $ => seq(
      'goto',
      choice(
        alias($.identifier, $.label_name),
        seq('case', $.expression_),
        'default'
      ),
      ';'
    ),

    if: $ => seq(
      $.if_clause,
      optional_with_placeholder('else_if_clause_list', repeat($.else_if_clause)),
      optional_with_placeholder('else_clause_optional', $.else_clause)
    ),

    if_clause: $ => seq(
      'if',
      '(',
      $.condition,
      ')', 
      field('if_consequence', $.statement)
    ),

    else_if_clause: $ => prec.dynamic(1, seq(
      'else', 
      'if', 
      '(',
      $.condition,
      ')', 
      field('if_consequence', $.statement)
    )),

    else_clause: $ => seq(
      'else', 
      field('if_consequence', $.statement)
    ),

    labeled_statement: $ => seq(
      alias($.identifier, $.label_name),
      ':',
      $.statement
    ),

    local_declaration_statement: $ => seq(
      optional('await'),
      optional('using'),
      optional_with_placeholder('modifier_list', repeat($.modifier)),
      $.assignment_with_type,
      ';'
    ),

    local_function_statement: $ => seq(
      optional_with_placeholder('attribute_list_placeholder', repeat($.attribute_list)),
      optional_with_placeholder('modifier_list', repeat($.modifier)),
      field('type_optional', $.return_type),
      field('name', $.identifier),
      optional($.type_parameter_list),
      field('parameters', $.parameter_block),
      optional_with_placeholder('type_parameter_constraint_list_optional', $.type_parameter_constraint_list),
      $.function_body
    ),

    lock_statement: $ => seq('lock', '(', $.expression_, ')', $.statement),

    return: $ => seq(
      'return', 
      optional_with_placeholder('return_value_optional', $.return_value), 
      ';'
    ),

    return_value: $ => $.expression_,

    switch_statement: $ => seq(
      'switch',
      choice(
        seq(
          '(',
          field('value', $.expression_),
          ')',
        ),
        field('value', $.tuple_expression)
      ),
      field('body', $.switch_body)
    ),

    switch_body: $ => seq(
      '{',
      repeat($.switch_section),
      '}'
    ),

    switch_section: $ => prec.left(seq(
      repeat1(choice( // switch_label
        $.case_switch_label,
        $.case_pattern_switch_label,
        $.default_switch_label
      )),
      repeat1($.statement)
    )),

    case_pattern_switch_label: $ => seq(
      'case',
      $._pattern,
      optional($.when_clause),
      ':'
    ),

    _pattern: $ => choice(
      $.constant_pattern,
      $.declaration_pattern,
      $.discard,
      $.recursive_pattern,
      $.var_pattern,
      $.negated_pattern,
      $.parenthesized_pattern,
      $.relational_pattern,
      $.binary_pattern,
      $.type_pattern
    ),

    type_pattern: $ => prec(PREC.TYPE_PATTERN, $.type),

    parenthesized_pattern: $ => seq('(', $._pattern, ')'),

    relational_pattern: $ => prec.left(choice(
      seq('<', $.expression_),
      seq('<=', $.expression_),
      seq('>', $.expression_),
      seq('>=', $.expression_)
    )),

    negated_pattern: $ => seq('not', $._pattern),

    binary_pattern: $ => choice(
      prec.left(PREC.AND, seq(
        field('left', $._pattern),
        field('operator', 'and'),
        field('right', $._pattern)
      )),
      prec.left(PREC.OR, seq(
        field('left', $._pattern),
        field('operator', 'or'),
        field('right', $._pattern)
      )),
    ),

    constant_pattern: $ => prec.right($.expression_),

    declaration_pattern: $ => seq(
      field('type_optional', $.type),
      $._variable_designation
    ),

    _variable_designation: $ => prec(1, choice(
      $.discard,
      $.parenthesized_variable_designation,
      $.identifier
    )),

    discard: $ => '_',

    parenthesized_variable_designation: $ => seq(
      '(',
      commaSep($._variable_designation),
      ')'
    ),

    recursive_pattern: $ => prec.left(seq(
      optional($.type),
      choice(
        seq(
          $.positional_pattern_clause,
          optional($.property_pattern_clause)
        ),
        $.property_pattern_clause
      ),
      optional($._variable_designation)
    )),

    positional_pattern_clause: $ => prec(1, seq(
      '(',
      optional(seq($.subpattern, ',', commaSep1($.subpattern))),// we really should allow single sub patterns, but that causes conficts, and will rarely be used
      ')',
    )),

    subpattern: $ => seq(
      optional($.name_colon),
      $._pattern
    ),

    property_pattern_clause: $ => prec(1, seq(
      '{',
      commaSep($.subpattern),
      optional(','),
      '}',
    )),

    var_pattern: $ => prec(1, seq('var', $._variable_designation)),

    when_clause: $ => seq('when', $.expression_),

    case_switch_label: $ => prec.left(1, seq('case', $.expression_, ':')),

    default_switch_label: $ => prec.left(1, seq('default', ':')),

    throw: $ => seq('throw', optional($.expression_), ';'),

    try: $ => seq(
      $.try_clause,
      optional_with_placeholder('catch_list', repeat($.catch)),
      optional_with_placeholder('finally_clause_optional', $.finally_clause),
    ),
    
    try_clause: $ => seq(
      'try', 
      $.enclosed_body
    ),

    catch: $ => seq(
      'catch',
      optional_with_placeholder('catch_parameter_optional', $.catch_declaration),
      optional_with_placeholder('catch_filter_optional', $.catch_filter_clause),
      field('body', $.enclosed_body)
    ),

    catch_declaration: $ => seq(
      '(',
      $.catch_parameter,
      ')'
    ),

    catch_parameter: $ => seq(
      field('type_optional', $.type),
      optional($.identifier), // name
    ),

    catch_filter_clause: $ => seq('when', '(', alias($.expression_, $.catch_filter), ')'),

    finally_clause: $ => seq('finally', $.enclosed_body),

    unsafe_statement: $ => seq('unsafe', $.enclosed_body),

    using_statement: $ => seq(
      optional('await'),
      'using',
      '(',
      choice($.assignment_with_type, $.expression_),
      ')',
      field('body', $.statement)
    ),

    while: $ => $.while_clause, 
    
    while_clause: $ => seq(
      'while', 
      '(', 
      $.condition, 
      ')', 
      field('while_body', $.statement)
    ),

    yield_statement: $ => seq(
      'yield',
      choice( // grammar.txt incorrectly allows "break expression", we do not.
        seq('return', $.expression_),
        'break'
      ),
      ';'
    ),

    anonymous_method_expression: $ => seq(
      optional($.async_modifier),
      'delegate',
      optional($.parameter_block),
      $.enclosed_body
    ),

    lambda: $ => prec(-1, seq(
      optional_with_placeholder('modifier_list', seq(
        optional($.async_modifier),
        optional($.static_modifier)
      )),
      choice($.parameter_block, 
        field('parameter', $.identifier)),
      '=>',
      choice($.enclosed_body, 
        field('return_value', $.expression_))
    )),

    anonymous_object_creation_expression: $ => seq(
      'new',
      '{',
      commaSep($._anonymous_object_member_declarator),
      optional(','),
      '}'
    ),

    implicit_object_creation_expression: $ => seq(
      'new',
      $.argument_list_parens,
      optional($.initializer_expression)
    ),

    _anonymous_object_member_declarator: $ => choice(
      prec.dynamic(PREC.ASSIGN, seq($.name_equals, $.expression_)),
      $.expression_
    ),

    array_creation_expression: $ => prec.dynamic(PREC.UNARY, seq(
      'new',
      $.array_type,
      optional($.initializer_expression)
    )),

    initializer_expression: $ => seq(
      '{',
      commaSep($.expression_),
      optional(','),
      '}'
    ),

    assignment_expression: $ => prec.right(seq(
      field('left', $.expression_),
      $.assignment_operator,
      field('right', $.expression_)
    )),

    assignment_operator: $ => choice('=', '+=', '-=', '*=', '/=', '%=', '&=', '^=', '|=', '<<=', '>>=', '??='),

    await_expression: $ => prec.right(PREC.UNARY, seq('await', $.expression_)),

    cast_expression: $ => prec.right(PREC.CAST, seq(
      '(',
      field('type_optional', $.type),
      ')',
      field('value', $.expression_)
    )),

    checked_expression: $ => choice(
      seq('checked', '(', $.expression_, ')'),
      seq('unchecked', '(', $.expression_, ')')
    ),

    conditional_access_expression: $ => prec.right(PREC.COND, seq(
      field('condition', $.expression_),
      '?',
      choice($.member_binding_expression, $.element_binding_expression)
    )),

    conditional_expression: $ => prec.right(PREC.COND, seq(
      field('condition', $.expression_),
      '?',
      field('consequence', $.expression_),
      ':',
      field('alternative', $.expression_)
    )),

    declaration_expression: $ => seq(
      field('type_optional', $.type),
      field('name', $.identifier)
    ),

    default_expression: $ => prec.right(seq(
      'default',
      optional(seq(
        '(',
        field('type_optional', $.type),
        ')'
      ))
    )),

    element_access_expression: $ => prec.right(PREC.UNARY, seq(
      field('expression', $.expression_),
      field('subscript', $.bracketed_argument_list)
    )),

    element_binding_expression: $ => $.bracketed_argument_list,

    implicit_array_creation_expression: $ => seq(
      'new',
      '[',
      repeat(','),
      ']',
      $.initializer_expression
    ),

    implicit_stack_alloc_array_creation_expression: $ => seq(
      'stackalloc',
      '[',
      ']',
      $.initializer_expression
    ),

    base_expression: $ => 'base',

    this_expression: $ => 'this',

    interpolated_string_expression: $ => choice(
      seq('$"', repeat($._interpolated_string_content), '"'),
      seq('$@"', repeat($._interpolated_verbatim_string_content), '"'),
      seq('@$"', repeat($._interpolated_verbatim_string_content), '"'),
    ),

    _interpolated_string_content: $ => choice(
      $.interpolated_string_text,
      $.interpolation
    ),

    _interpolated_verbatim_string_content: $ => choice(
      $.interpolated_verbatim_string_text,
      $.interpolation
    ),

    interpolated_string_text: $ => choice(
      '{{',
      $._interpolated_string_text_fragment,
      $.escape_sequence
    ),

    _interpolated_string_text_fragment: $ => token.immediate(prec(1, /[^{"\\\n]+/)),

    interpolated_verbatim_string_text: $ => choice(
      '{{',
      $._interpolated_verbatim_string_text_fragment,
      '""'
    ),

    _interpolated_verbatim_string_text_fragment: $ => token.immediate(prec(1, /[^{"]+/)),

    interpolation: $ => seq(
      '{',
      $.expression_,
      optional($.interpolation_alignment_clause),
      optional($.interpolation_format_clause),
      '}'
    ),

    interpolation_alignment_clause: $ => seq(',', $.expression_),

    interpolation_format_clause: $ => seq(':', /[^}"]+/),

    invocation_expression: $ => prec(PREC.INVOCATION, seq(
      field('function_', $.expression_),
      field('arguments', $.argument_list_parens)
    )),

    is_pattern_expression: $ => prec.left(PREC.EQUAL, seq(
      field('expression', $.expression_),
      'is',
      field('pattern', $._pattern)
    )),

    make_ref_expression: $ => seq(
      '__makeref',
      '(',
      $.expression_,
      ')'
    ),

    member_access_expression: $ => prec(PREC.DOT, seq(
      field('expression', choice($.expression_, $.predefined_type, $._name)),
      choice('.', '->'),
      field('name', $._simple_name)
    )),

    member_binding_expression: $ => seq(
      '.',
      field('name', $._simple_name),
    ),

    object_creation_expression: $ => prec.right(seq(
      'new',
      field('type_optional', $.type),
      optional(field('arguments', $.argument_list_parens)),
      optional(field('initializer', $.initializer_expression))
    )),

    parenthesized_expression: $ => seq('(', $.expression_, ')'),

    postfix_unary_expression: $ => prec.left(PREC.POSTFIX, choice(
      seq($.expression_, '++'),
      seq($.expression_, '--'),
      seq($.expression_, '!')
    )),

    prefix_unary_expression: $ => prec.right(PREC.UNARY, choice(
      ...[
        '!',
        '&',
        '*',
        '+',
        '++',
        '-',
        '--',
        '^',
        '~'
      ].map(operator => seq(operator, $.expression_)))),

    query_expression: $ => seq($.from_clause, $._query_body),

    from_clause: $ => seq(
      'from',
      optional($.type),
      $.identifier,
      'in',
      $.expression_
    ),

    _query_body: $ => prec.right(seq(
      repeat($._query_clause), // grammar.txt is incorrect with '+'
      $._select_or_group_clause,
      optional($.query_continuation)
    )),

    _query_clause: $ => choice(
      $.from_clause,
      $.join_clause,
      $.let_clause,
      $.order_by_clause,
      $.where_clause
    ),

    join_clause: $ => seq(
      'join',
      optional($.type),
      $.identifier,
      'in',
      $.expression_,
      'on',
      $.expression_,
      'equals',
      $.expression_,
      optional($.join_into_clause)
    ),

    join_into_clause: $ => seq('into', $.identifier),

    let_clause: $ => seq(
      'let',
      $.identifier,
      '=',
      $.expression_
    ),

    order_by_clause: $ => seq(
      'orderby',
      commaSep1($._ordering)
    ),

    _ordering: $ => seq(
      $.expression_,
      optional(choice('ascending', 'descending'))
    ),

    where_clause: $ => seq('where', $.expression_),

    _select_or_group_clause: $ => choice(
      $.group_clause,
      $.select_clause
    ),

    group_clause: $ => prec.right(PREC.SELECT, seq(
      'group',
      $.expression_,
      'by',
      $.expression_
    )),

    select_clause: $ => prec.right(PREC.SELECT, seq('select', $.expression_)),

    query_continuation: $ => seq('into', $.identifier, $._query_body),

    range_expression: $ => prec.right(PREC.RANGE, seq(
      optional($.expression_),
      '..',
      optional($.expression_)
    )),

    ref_expression: $ => prec.right(seq('ref', $.expression_)),

    ref_type_expression: $ => seq(
      '__reftype',
      '(',
      $.expression_,
      ')'
    ),

    ref_value_expression: $ => seq(
      '__refvalue',
      '(',
      field('value', $.expression_),
      ',',
      field('type_optional', $.type),
      ')'
    ),

    size_of_expression: $ => seq(
      'sizeof',
      '(',
      $.type,
      ')'
    ),

    stack_alloc_array_creation_expression: $ => seq(
      'stackalloc',
      $.array_type,
      optional($.initializer_expression)
    ),

    switch_expression: $ => prec(PREC.SWITCH, seq(
      $.expression_,
      'switch',
      '{',
      commaSep($.switch_expression_arm),
      optional(','),
      '}',
    )),

    switch_expression_arm: $ => seq(
      $._pattern,
      optional($.when_clause),
      '=>',
      $.expression_
    ),

    throw_expression: $ => prec.right(seq('throw', $.expression_)),

    tuple_expression: $ => seq(
      '(',
      $.argument,
      repeat1(seq(
        ',',
        $.argument,
      )),
      ')'
    ),

    type_of_expression: $ => seq('typeof', '(', $.type, ')'),

    with_expression: $ => prec.left(PREC.WITH,
      seq($.expression_, 'with', '{', optional($.with_initializer_expression), '}')),

    with_initializer_expression: $ => commaSep1($.simple_assignment_expression),

    simple_assignment_expression: $ => seq($.identifier, '=', $.expression_),

    expression_: $ => choice(
      $.anonymous_method_expression,
      $.anonymous_object_creation_expression,
      $.array_creation_expression,
      $.as_expression,
      $.assignment_expression,
      $.await_expression,
      $.base_expression,
      $.binary_expression,
      $.cast_expression,
      $.checked_expression,
      $.conditional_access_expression,
      $.conditional_expression,
      $.default_expression,
      $.element_access_expression,
      $.element_binding_expression,
      $.implicit_array_creation_expression,
      $.implicit_object_creation_expression,
      $.implicit_stack_alloc_array_creation_expression,
      $.initializer_expression,
      $.interpolated_string_expression,
      $.invocation_expression,
      $.is_expression,
      $.is_pattern_expression,
      $.lambda,
      $.make_ref_expression,
      $.member_access_expression,
      // $.member_binding_expression, // Not needed as handled directly in $.conditional_access_expression
      $.object_creation_expression,
      $.parenthesized_expression,
      $.postfix_unary_expression,
      $.prefix_unary_expression,
      $.query_expression,
      $.range_expression,
      $.ref_expression,
      $.ref_type_expression,
      $.ref_value_expression,
      $.size_of_expression,
      $.stack_alloc_array_creation_expression,
      $.switch_expression,
      $.this_expression,
      $.throw_expression,
      $.tuple_expression,
      $.type_of_expression,
      $.with_expression,

      $._simple_name,
      $._literal
    ),

    binary_expression: $ => choice(
      ...[
        ['&&', PREC.LOGAND], // logical_and_expression
        ['||', PREC.LOGOR], // logical_or_expression
        ['>>', PREC.SHIFT], // right_shift_expression
        ['<<', PREC.SHIFT], // left_shift_expression
        ['&', PREC.AND],  // bitwise_and_expression
        ['^', PREC.XOR], // exclusive_or_expression
        ['|', PREC.OR], // bitwise_or_expression
        ['+', PREC.ADD], // add_expression
        ['-', PREC.ADD], // subtract_expression
        ['*', PREC.MULT], // multiply_expression
        ['/', PREC.MULT], // divide_expression
        ['%', PREC.MULT], // modulo_expression
        ['<', PREC.REL], // less_than_expression
        ['<=', PREC.REL], // less_than_or_equal_expression
        ['==', PREC.EQUAL], // equals_expression
        ['!=', PREC.EQUAL], // not_equals_expression
        ['>=', PREC.REL], // greater_than_or_equal_expression
        ['>', PREC.REL] //  greater_than_expression
      ].map(([operator, precedence]) =>
        prec.left(precedence, seq(
          field('left', $.expression_),
          field('operator', operator),
          field('right', $.expression_)
        ))
      ),
      prec.right(PREC.COALESCING, seq(
        field('left', $.expression_),
        field('operator', '??'), // coalesce_expression
        field('right', $.expression_)
      ))
    ),

    as_expression: $ => prec.left(PREC.EQUAL, seq(
      field('left', $.expression_),
      field('operator', 'as'),
      field('right', $.type)
    )),

    is_expression: $ => prec.left(PREC.EQUAL, seq(
      field('left', $.expression_),
      field('operator', 'is'),
      field('right', $.type)
    )),

    // Unicode categories: L = Letter, Nl Letter_Number, = Nd = Decimal_Number, Pc = Connector_Punctuation, Cf = Format, Mn = Nonspacing_Mark, Mc = Spacing_Mark
    _identifier_token: $ => token(seq(optional('@'), /[\p{L}\p{Nl}_][\p{L}\p{Nl}\p{Nd}\p{Pc}\p{Cf}\p{Mn}\p{Mc}]*/)),
    identifier: $ => choice($._identifier_token, $._contextual_keywords),

    global: $ => 'global',
    _identifier_or_global: $ => choice($.global, $.identifier),

    // Literals - grammar.txt is useless here as it just refs to lexical specification

    _literal: $ => choice(
      $.null_literal,
      $.boolean_literal,
      $.character_literal,
      // Don't combine real and integer literals together
      $.real_literal,
      $.integer_literal,
      // Or strings and verbatim strings
      $.string_literal,
      $.verbatim_string_literal
    ),

    boolean_literal: $ => choice(
      'true',
      'false'
    ),

    character_literal: $ => seq(
      "'",
      choice(token.immediate(/[^'\\]/), $.escape_sequence),
      "'"
    ),

    escape_sequence: $ => token(choice(
      /\\x[0-9a-fA-F][0-9a-fA-F]?[0-9a-fA-F]?[0-9a-fA-F]?/,
      /\\u[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]/,
      /\\U[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]/,
      /\\[^xuU]/,
    )),

    integer_literal: $ => token(seq(
      choice(
        decimalDigitSequence, // Decimal
        (/0[xX][0-9a-fA-F_]*[0-9a-fA-F]+/), // Hex
        (/0[bB][01_]*[01]+/) // Binary
      ),
      optional(/u|U|l|L|ul|UL|uL|Ul|lu|LU|Lu|lU/)
    )),

    null_literal: $ => 'null',

    real_literal: $ => {
      const suffix = /[fFdDmM]/;
      const exponent = /[eE][+-]?[0-9][0-9_]*/;
      return token(choice(
        seq(
          decimalDigitSequence,
          '.',
          decimalDigitSequence,
          optional(exponent),
          optional(suffix)
        ),
        seq(
          '.',
          decimalDigitSequence,
          optional(exponent),
          optional(suffix)
        ),
        seq(
          decimalDigitSequence,
          exponent,
          optional(suffix)
        ),
        seq(
          decimalDigitSequence,
          suffix
        )
      ))
    },

    string_literal: $ => seq(
      '"',
      repeat(choice(
        $._string_literal_fragment,
        $.escape_sequence
      )),
      '"'
    ),

    _string_literal_fragment: $ => token.immediate(prec(1, /[^"\\\n]+/)),

    verbatim_string_literal: $ => token(seq(
      '@"',
      repeat(choice(
        /[^"]/,
        '""',
      )),
      '"'
    )),

    // Comments

    comment: $ => token(choice(
      seq('//', /[^\n\r]*/),
      seq(
        '/*',
        /[^*]*\*+([^/*][^*]*\*+)*/,
        '/'
      )
    )),

    // Custom non-Roslyn additions beyond this point that will not sync up with grammar.txt

    // Contextual keywords - keywords that can also be identifiers...
    _contextual_keywords: $ => choice(
      // LINQ comprehension syntax
      'ascending',
      'by',
      'descending',
      'equals',
      'from',
      'group',
      'into',
      'join',
      'let',
      'on',
      'orderby',
      'select',
      'where',

      // Property/event handlers
      'add',
      'get',
      'remove',
      'set',

      // Async - These need to be more contextual
      // 'async',
      // 'await',

      // Misc
      'global',
      'alias',
      'dynamic',
      'nameof',
      'notnull',
      'unmanaged',
      'when',
      'yield'
    ),

    // We use this instead of type so 'void' is only treated as type in the right contexts
    return_type: $ => choice($.type, $.void_keyword),
    void_keyword: $ => field('type', 'void'),

    preprocessor_call: $ => seq(
      $._preproc_directive_start,
      choice(
        $.nullable_directive,
        $.define_directive,
        $.undef_directive,
        $.if_directive,
        $.else_directive,
        $.elif_directive,
        $.endif_directive,
        $.region_directive,
        $.endregion_directive,
        $.error_directive,
        $.warning_directive,
        $.line_directive,
        $.pragma_directive
      ),
      $._preproc_directive_end
    ),

    _preproc_directive_start: $ => /#[ \t]*/,

    nullable_directive: $ => seq(
      'nullable',
      choice('disable', 'enable', 'restore'),
      optional(choice('annotations', 'warnings'))
    ),

    // Preprocessor

    define_directive: $ => seq('define', $.identifier),
    undef_directive: $ => seq('undef', $.identifier),
    if_directive: $ => seq('if', $._preproc_expression),
    else_directive: $ => 'else',
    elif_directive: $ => seq('elif', $._preproc_expression),
    endif_directive: $ => 'endif',
    region_directive: $ => seq('region', optional($.preproc_message)),
    endregion_directive: $ => seq('endregion', optional($.preproc_message)),
    error_directive: $ => seq('error', $.preproc_message),
    warning_directive: $ => seq('warning', $.preproc_message),
    line_directive: $ => seq('line',
      choice(
        'default',
        'hidden',
        seq($.preproc_integer_literal, optional($.preproc_string_literal))
      )
    ),
    pragma_directive: $ => seq('pragma',
      choice(
        seq('warning',
          choice('disable', 'restore'),
          commaSep(
            choice(
              $.identifier,
              alias($.preproc_integer_literal, $.integer_literal),
            ))),
        seq('checksum', $.preproc_string_literal, $.preproc_string_literal, $.preproc_string_literal)
      )
    ),

    preproc_message: $ => /[^\n\r]+/,
    preproc_integer_literal: $ => /[0-9]+/,
    preproc_string_literal: $ => /"[^"]*"/,

    _preproc_expression: $ => choice(
      $.identifier,
      $.boolean_literal,
      alias($.preproc_integer_literal, $.integer_literal),
      alias($.preproc_string_literal, $.verbatim_string_literal),
      alias($.preproc_unary_expression, $.prefix_unary_expression),
      alias($.preproc_binary_expression, $.binary_expression),
      alias($.preproc_parenthesized_expression, $.parenthesized_expression)
    ),

    preproc_parenthesized_expression: $ => seq(
      '(',
      $._preproc_expression,
      ')'
    ),

    preproc_unary_expression: $ => prec.left(PREC.UNARY, seq(
      field('operator', '!'),
      field('argument', $._preproc_expression)
    )),

    preproc_binary_expression: $ => {
      const table = [
        ['||', PREC.LOGOR],
        ['&&', PREC.LOGAND],
        ['==', PREC.EQUAL],
        ['!=', PREC.EQUAL],
      ];

      return choice(...table.map(([operator, precedence]) => {
        return prec.left(precedence, seq(
          field('left', $._preproc_expression),
          field('operator', operator),
          field('right', $._preproc_expression)
        ))
      }));
    },
  }
})

function commaSep(rule) {
  return optional(commaSep1(rule))
}

function commaSep1(rule) {
  return seq(
    rule,
    repeat(seq(
      ',',
      rule
    ))
  )
}

function optional_with_placeholder(field_name, rule) {
  return choice(field(field_name, rule), field(field_name, blank()));
}
