define([
    'base/js/namespace',
    'require',
    './drawing'
], function(Jupyter, require, drawing) {
    function setupCell(cell, defaultContent) {
        /* Hide all the default cell stuff */
        let divs = cell.element[0].querySelectorAll(":scope > div");
        for (let i = 0; i < divs.length; i++) {
            divs[i].style.display = "none"; 
        }
        
        let context = drawing.initialise(cell.element);
        cell.metadata.drawing_enabled = "true";
        
        /* Set the canvas contents if anything is given */        
        updateCellContents(cell, context);
        context.setAutosaveHandler(() => {
            updateCellContents(cell, context);
            Jupyter.notebook.save_notebook();
        });

        /* Load the default image */
        if (defaultContent) {
            context.loadImageFromUrl(defaultContent);
        }
    }
    
    function insertCell() {
        let cell = Jupyter.notebook.insert_cell_below("markdown");
        setupCell(cell);
    }

    function updateCellContents(cell, context) {
        let description = "Drawing created with the notebook-drawing extension (github.com/nicknytko/notebook-drawing)"
        let text =`<img src="${context.getCanvasData()}" title="${description}. Install the extension to edit." alt="${description}"/>`;
        cell.set_text(text);
        /*cell.execute();*/
    }

    function loadCellsOnStartup(cells) {
        cells.forEach(cell => {
            if (cell.metadata.drawing_enabled) {
                let text = cell.get_text();
                let contents = text.split("\"")[1]; // this seems fragile, but I don't know of a better way
                setupCell(cell, contents);
            }
        });
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

        loadCellsOnStartup(Jupyter.notebook.get_cells());
    }

    return {
        load_ipython_extension: initialise
    };
});
