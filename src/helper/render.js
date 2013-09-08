/**
 * Has all of the rendering functions.
 *
 * Depends on tree_util heavily.
 */


var Render = (function() {
    var Render = {};

    /**
     * Renders the task subtree rooted at task (including task itself)
     * @param task. {Datastore.Record}. Task to be rendered
     * @returns {Zepto element}. Zepto selector on div for task. Subtree
     *      rooted at task is fully rendered.
     */
    var renderTask = Render.renderTask = function(task){
        var $task = ich.task(DatastoreUtil.getFieldValuesWithId(task));

        // render the children and attach
        var children = taskTable.query({parentId: task.getId()});
        var $subtasksList = $task.children(".tasks");
        $subtasksList.empty();
        _.each(children, function(child){
            $subtasksList.append(renderTask(child));
        });

        // attach the task form and hide
        var $taskForm = ich.taskForm();
        $taskForm.hide();
        $task.append($taskForm);

        return $task;
    }



})();
