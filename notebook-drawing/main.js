define([
    'base/js/namespace',
    'require',
    './drawing'
], function(Jupyter, require, drawing) {
    function setupCell(cell) {
        drawing.initialise(cell.element);
    }
    
    function insertCell() {
        let cell = Jupyter.notebook.insert_cell_below("code");
        setupCell(cell);
    }
    
    function initialise() {
        var action = {
            icon: 'fa-paint-brush', // a font-awesome class used on buttons, etc
            help    : 'Insert Drawing Canvas',
            help_index : 'zz',
            handler : insertCell
        };
        var prefix = 'notebook-drawing';
        var action_name = 'insert-canvas';

        var full_action_name = Jupyter.actions.register(action, action_name, prefix); // returns 'my_extension:show-alert'
        Jupyter.toolbar.add_buttons_group([full_action_name]);
    }

    return {
        load_ipython_extension: initialise
    };
});
