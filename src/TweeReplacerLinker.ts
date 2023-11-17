import type {LifeTimeCircleHook, LogWrapper} from "../../../dist-BeforeSC2/ModLoadController";
import type {SC2DataManager} from "../../../dist-BeforeSC2/SC2DataManager";
import type {ModUtils} from "../../../dist-BeforeSC2/Utils";
import type {ModBootJson, ModBootJsonAddonPlugin, ModInfo} from "../../../dist-BeforeSC2/ModLoader";
import type {AddonPluginHookPointEx} from "../../../dist-BeforeSC2/AddonPlugin";
import type {ModZipReader} from "../../../dist-BeforeSC2/ModZipReader";
import type {SC2DataInfoCache, SC2DataInfo} from "../../../dist-BeforeSC2/SC2DataInfoCache";
import {isArray, isNil, isString} from 'lodash';
import {
    TweeReplacerLinkerClientCallbackType,
    TweeReplacerLinkerClientInterface,
    TweeReplacerLinkerInterface
} from "./TweeReplacerLinkerInterface";

export interface TweeReplacerLinkerCallbackData {
    clientName: string;
    userModName: string;
    callback: TweeReplacerLinkerClientCallbackType;
}

export class TweeReplacerLinker implements AddonPluginHookPointEx, TweeReplacerLinkerInterface {
    private logger: LogWrapper;

    constructor(
        public gSC2DataManager: SC2DataManager,
        public gModUtils: ModUtils,
    ) {
        this.logger = gModUtils.getLogger();
        this.gModUtils.getAddonPluginManager().registerAddonPlugin(
            'TweeReplacerLinker',
            'TweeReplacerLinkerAddon',
            this,
        );
        const theName = this.gModUtils.getNowRunningModName();
        if (!theName) {
            console.error('[TweeReplacerLinker] init() (!theName).', [theName]);
            this.logger.error(`[TweeReplacerLinker] init() [${theName}].`);
            return;
        }
        const mod = this.gModUtils.getMod(theName);
        if (!mod) {
            console.error('[TweeReplacerLinker] init() (!mod). ', [theName]);
            this.logger.error(`[TweeReplacerLinker] init() (!mod). [${theName}].`);
            return;
        }
        console.log('[TweeReplacerLinker] register modRef done.', [theName]);
        this.logger.log(`[TweeReplacerLinker] register modRef done. [${theName}].`);
        mod.modRef = this;
    }

    canRegister = true;

    async registerClient(client: TweeReplacerLinkerClientInterface) {
        if (!this.canRegister) {
            return false;
        }
        if (await client.enableLinkerMode()) {
            return true;
        }
        return false;
    }

    userCallback: TweeReplacerLinkerCallbackData[] = [];

    async addUserMod(clientName: string, userModName: string, callback: TweeReplacerLinkerClientCallbackType) {
        if (!clientName) {
            console.error('[TweeReplacerLinker] addUserMod() (!clientName).', [clientName, userModName, callback]);
            this.logger.error(`[TweeReplacerLinker] addUserMod() (!clientName). [${clientName}] [${userModName}]`);
            return false;
        }
        this.userCallback.push({
            clientName,
            userModName,
            callback,
        });
        return true;
    }

    async registerMod(addonName: string, mod: ModInfo, modZip: ModZipReader) {
        const ad = mod.bootJson.addonPlugin?.find((T: ModBootJsonAddonPlugin) => {
            return T.modName === 'TweeReplacerLinker'
                && T.addonName === 'TweeReplacerLinkerAddon';
        });
        if (!ad) {
            // never go there
            console.error('[TweeReplacerLinker] registerMod() (!ad). never go there.', [mod]);
            this.logger.error(`[TweeReplacerLinker] registerMod() (!ad). never go there. ${mod.name} `);
            return;
        }
    }

    async afterPatchModToGame() {
        this.canRegister = false;
        const scOld: SC2DataInfoCache = this.gSC2DataManager.getSC2DataInfoAfterPatch();
        const sc = scOld.cloneSC2DataInfo();

        // call as addUserMod order
        for (const cc of this.userCallback) {
            try {
                await cc.callback(sc);
            } catch (e: any | Error) {
                console.error(`[TweeReplacerLinker] afterPatchModToGame() error `, [cc.clientName, cc.userModName, cc], e);
                this.logger.error(`[TweeReplacerLinker] afterPatchModToGame() error ${cc.clientName} ${cc.userModName} ${e?.message ? e.message : e}`);
            }
        }

        sc.passageDataItems.back2Array();
        this.gModUtils.replaceFollowSC2DataInfo(sc, scOld);
    }


    init() {
    }
}
