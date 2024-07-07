import { DecisionRoute, DecisionRouteMode } from "Routes";
import { Util } from "Util";
import { Data } from "Data";
import { Controller } from "Controller";
import { View } from "View";
import { Dom, VDom } from "Dom";

export class Response {

    public static async rendering (route: DecisionRoute) {

        try{

            // Controller & View Leave 
            const befCont : Controller = Data.get("beforeController");
            if(befCont){
                await befCont.handleLeave(Data.get("beforeControllerAction"));
            }

            const befView = Data.get("beforeView");
            if(befView) await befView.handleLeave();

            if(route.mode == DecisionRouteMode.Notfound) throw("Page Not found");

            if(route.controller){
                await Response.renderingOnController(route);
            }
            else if(route.view){
                await Response.renderingOnView(route);
            }

        }catch(error) {
            console.error(error);

        }
    }

    private static async renderingOnController(route : DecisionRoute) {
        const controllerName : string = Util.getModuleName(route.controller + "Controller");
        const controllerPath : string = "app/controllers/" + Util.getModulePath(route.controller + "Controller");
        if(!useExists(controllerPath)){
            throw("\"" + controllerPath + "\" Class is not found.");
        }

        const controllerClass = use(controllerPath);
        const cont : Controller = new controllerClass[controllerName]();

        const viewName = route.action + "View";
        const viewPath : string = "app/views/" + route.controller + "/" + Util.getModulePath(viewName);
        
        let vw : View; 
        if(useExists(viewPath)){
            const View_ = use(viewPath);
            vw = new View_();
        }

        let beginStatus = false;
        if(Data.get("beforeControllerPath")  != controllerPath){
            Data.set("beforeControllerPath", controllerPath);
            beginStatus = true;
        }

        await cont.handleBefore(beginStatus);
        if(vw) await vw.handleBefore(beginStatus);

        Data.set("beforeController", cont);
        Data.set("beforeControllerAction", route.action);
        Data.set("beforeView", null);
        Data.set("beforeViewPath", null);
        Data.set("childClasss", {});
        
        if(cont["before_" + route.action]){
            const method : string = "before_" + route.action;
            if(route.args){
                await cont[method](...route.args);
            }
            else{
                await cont[method]();
            }
        }

        await cont.handleAfter(beginStatus);
        if(vw) await vw.handleAfter(beginStatus);
        console.log("rendring ready?");
        await Response.__rendering(route, cont);
        console.log("rendring?");

        await cont.handleRenderBefore(beginStatus);
        if(vw) await vw.handleRenderBefore(beginStatus);

        if(cont[route.action]){
            const method : string = route.action;
            if(route.args){
                await cont[method](...route.args);
            }
            else{
                await cont[method]();
            }
        }

        if(vw){
            if(route.args){
                await vw.handle(...route.args);
            }
            else{
                await vw.handle();
            }
        }

        await cont.handleRenderAfter(beginStatus); 
        if(vw) await vw.handleRenderAfter(beginStatus);
    }


    private static async renderingOnView(route : DecisionRoute) {
        const viewName : string = Util.getModuleName(route.controller + "View");
        const viewPath : string = "app/views/" + Util.getModulePath(route.controller + "View");

        if(!useExists(viewPath)){
            throw("\"" + viewName + "\" Class is not found.");
        }

        const View_ = use(viewPath);
        const vm : View = new View_();

        if(Data.get("beforeViewPath") != viewPath){
            Data.set("beforeViewPath", viewPath);
            if(vm.handleBegin) await vm.handleBegin();
        }

        Data.set("beforeView", vm);
        Data.set("beforeController", null);
        Data.set("beforeControllerPath", null);
        Data.set("beforeControllerAction", null);
        Data.set("childClasss",  {});

        await vm.handleBefore();

        await vm.handleAfter();

        await Response.__rendering(route, vm);

        await vm.handleRenderBefore();

        if(route.args){
            await vm.handle(...route.args);
        }
        else{
            await vm.handle();
        }

        await vm.handleRenderAfter();
    }

    public static async __rendering(route : DecisionRoute, context){

        if(!context.view){
            if(route.controller){
                context.view = route.controller + "/" + route.action;
            }
            else if(route.view){
                context.view = route.view;
            }
        }

        if(context.template){
            const beforeTemplate : string = Data.get("beforeTemplate");
            if(beforeTemplate != context.template){
                Data.set("beforeTemplate", context.template);
                const templateHtml = Response.template(context.template);
                Dom("body").html = templateHtml;
//                await Response.loadRenderingClass("Template", context.template);
            }
            const viewHtml = Response.view(context.view);
            Dom("content").html = viewHtml;    
        }
        else{
            Data.set("beforeTemplate", null);
            const viewHtml = Response.view(context.view);
            Dom("body").html = viewHtml;
        }

        const beforeHead = Data.get("beforeHead");
        if (beforeHead != context.head) {
            Data.set("beforeHead", context.head);
            if (context.head){
                const headHtml =  Response.viewPart(context.head);
                Dom("head").html = headHtml;
            }
        }

        const beforeHeader = Data.get("beforeHeader");
        if (beforeHeader != context.header) {
            Data.set("beforeHeader", context.header);
            if (context.header){
                const headerHtml =  Response.viewPart(context.header);
                Dom("header").html = headerHtml;
            }
        }

        const beforeFooter = Data.get("beforeFooter");
        if (beforeFooter != context.footer) {
            Data.set("beforeFooter", context.footer);
            if (context.footer){
                const foooterHtml =  Response.viewPart(context.footer);
                Dom("footer").html = foooterHtml;
            }
        }

  //      Response.setBindView();
//        Response.setBindTemplate();
  //      Response.setBindViewPart();

        VDom().refresh();
    }

    /**
     * *** view *** : 
     * Get View's content information.
     * @param {string} viewName View Name
     * @returns {string} view contents
     */
    public static view(viewName : string) : string{

        const viewPath : string = "rendering/views/" + viewName + ".html";
        if(!useExists(viewPath)){
            return "<div style=\"font-weight:bold;\">[Rendering ERROR] View data does not exist. Check if source file \"" + viewPath + "\" exists.</div>"; 
        }
        
        let content : string = use(viewPath);
        content = Util.base64Decode(content);
        content = this.renderConvert(content);

        return content;
    }

    /**
     * ***template*** : 
     * Get template content information.
     * @param {string} templateName Template Name
     * @returns {string} template contents
     */
    public static template(templateName : string) : string{

        const templatePath : string = "rendering/template/" + templateName + ".html";

        if(!useExists(templatePath)){
            return "<div style=\"font-weight:bold;\">[Rendering ERROR] Template data does not exist. Check if source file \"" + templatePath + "\" exists.</div>"; 
        }

        let content : string = use(templatePath);
        content = Util.base64Decode(content);
        content = this.renderConvert(content);

        return content;
    }

    /**
     * ***viewPart*** : 
     * Get viewPart content information.
     * @param {string} viewPartName ViewPart Name
     * @returns {string} viewPart contents
     */
    public static viewPart(viewPartName : string) : string{

        const viewPartPath : string = "rendering/viewparts/" + viewPartName + ".html";
        if(!useExists(viewPartPath)){
            return "<div style=\"font-weight:bold;\">ViewPart data does not exist. Check if source file \"" + viewPartPath + "\" exists.</div>";
        }
        
        let content = use(viewPartPath);
        content = Util.base64Decode(content);
        content = this.renderConvert(content);
        
        const vw = document.createElement("template");
        vw.innerHTML = content;
//        Response.setBindViewPart(vw);
    
        return vw.innerHTML;
    }

    private static renderConvert(content : string) {
        const contentDom = document.createElement("div");
        contentDom.innerHTML = content;

        // link tag check...
        const links =contentDom.querySelectorAll("link");
        for (let n = 0 ; n < links.length ; n++) {
            const link = links[n];
            const href = link.attributes["href"].value;
            if (!Util.existPublic(href)) continue;
            const resource = Util.getPublic(href);
            link.setAttribute("href", resource);
        }

        // image tag check...
        const imgs =contentDom.querySelectorAll("img");
        for (let n = 0 ; n < imgs.length ; n++) {
            const img = imgs[n];
            const src = img.attributes["src"].value;
            if (!Util.existPublic(src)) continue;
            const resource = Util.getPublic(src);
            img.setAttribute("src", resource);
        }
        
        content = contentDom.innerHTML;
        return content;
    }
}