// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
// made this to just create the ids for each speech

export const createSpeechID = (id : number) => {

    return id.toString().padStart(4, '0');

}